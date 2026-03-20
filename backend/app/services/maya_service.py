import base64
import hashlib
import hmac
import json
import os
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx


def _clean_env(value: str) -> str:
    return (value or "").strip().strip('"').strip("'")


MAYA_BASE_URL = _clean_env(os.getenv("MAYA_BASE_URL", "https://pg-sandbox.paymaya.com"))
MAYA_PUBLIC_KEY = _clean_env(os.getenv("MAYA_PUBLIC_KEY", ""))
MAYA_SECRET_KEY = _clean_env(os.getenv("MAYA_SECRET_KEY", ""))
MAYA_WEBHOOK_SECRET = _clean_env(os.getenv("MAYA_WEBHOOK_SECRET", ""))
MAYA_ENV = _clean_env(os.getenv("MAYA_ENV", "sandbox")).lower()
MAYA_ALLOW_LIVE = _clean_env(os.getenv("MAYA_ALLOW_LIVE", "false")).lower() == "true"


def _build_basic_auth(api_key: str) -> str:
    token = base64.b64encode(f"{api_key}:".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


def maya_is_configured() -> bool:
    return bool(MAYA_PUBLIC_KEY and MAYA_SECRET_KEY)


def enforce_test_mode() -> None:
    is_sandbox_url = "sandbox" in MAYA_BASE_URL.lower()
    is_sandbox_env = MAYA_ENV == "sandbox"
    if (not is_sandbox_url or not is_sandbox_env) and not MAYA_ALLOW_LIVE:
        raise ValueError(
            "Maya live mode is blocked. Keep MAYA_ENV=sandbox and sandbox base URL during testing, "
            "or set MAYA_ALLOW_LIVE=true only when you are intentionally going live."
        )


def normalize_checkout_status(payload: Dict[str, Any]) -> str:
    payment_status = str(payload.get("paymentStatus") or payload.get("status") or "").lower()

    if payment_status in {"payment_success", "completed", "paid", "success"}:
        return "paid"
    if payment_status in {"failed", "payment_failed", "declined", "error"}:
        return "failed"
    if payment_status in {"cancelled", "canceled"}:
        return "cancelled"
    if payment_status in {"pending", "for_authentication", "for_confirmation"}:
        return "pending"

    return "unknown"


async def create_checkout(
    *,
    amount: Decimal,
    reference_number: str,
    success_url: str,
    failure_url: str,
    cancel_url: str,
    buyer_first_name: Optional[str] = None,
    buyer_last_name: Optional[str] = None,
    buyer_email: Optional[str] = None,
) -> Dict[str, Any]:
    enforce_test_mode()

    if not MAYA_PUBLIC_KEY:
        raise RuntimeError("Maya public key is not configured. Set MAYA_PUBLIC_KEY for Checkout API calls.")

    headers = {
        "Authorization": _build_basic_auth(MAYA_PUBLIC_KEY),
        "Content-Type": "application/json",
    }

    payload: Dict[str, Any] = {
        "totalAmount": {
            "value": float(amount),
            "currency": "PHP",
        },
        "requestReferenceNumber": reference_number,
        "redirectUrl": {
            "success": success_url,
            "failure": failure_url,
            "cancel": cancel_url,
        },
        "items": [
            {
                "name": "Casaligan Platform Fee",
                "quantity": 1,
                "code": "platform-fee",
                "amount": {
                    "value": float(amount),
                    "currency": "PHP",
                },
                "totalAmount": {
                    "value": float(amount),
                    "currency": "PHP",
                },
            }
        ],
    }

    if buyer_first_name or buyer_last_name or buyer_email:
        payload["buyer"] = {
            "firstName": buyer_first_name or "Owner",
            "lastName": buyer_last_name or "User",
            "contact": {
                "email": buyer_email or "owner@example.com",
            },
        }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{MAYA_BASE_URL}/checkout/v1/checkouts",
                headers=headers,
                json=payload,
            )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else 0
        response_text = exc.response.text[:500] if exc.response is not None else ""
        raise RuntimeError(
            f"Maya checkout failed ({status_code}). Please verify sandbox API keys/config. {response_text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Maya checkout request failed: {exc}") from exc


async def retrieve_checkout(checkout_id: str) -> Dict[str, Any]:
    enforce_test_mode()

    key_candidates = []
    if MAYA_PUBLIC_KEY:
        key_candidates.append(MAYA_PUBLIC_KEY)
    if MAYA_SECRET_KEY and MAYA_SECRET_KEY != MAYA_PUBLIC_KEY:
        key_candidates.append(MAYA_SECRET_KEY)
    if not key_candidates:
        raise RuntimeError("Maya API keys are not configured. Set MAYA_PUBLIC_KEY and MAYA_SECRET_KEY.")

    last_exc: Optional[Exception] = None
    for api_key in key_candidates:
        headers = {
            "Authorization": _build_basic_auth(api_key),
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    f"{MAYA_BASE_URL}/checkout/v1/checkouts/{checkout_id}",
                    headers=headers,
                )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response is not None else 0
            response_text = exc.response.text if exc.response is not None else ""
            last_exc = exc

            is_auth_error = status_code == 401
            has_scope_or_credential_error = (
                "K007" in response_text
                or "Invalid key scope" in response_text
                or "K004" in response_text
                or "Invalid endpoint" in response_text
                or "K003" in response_text
                or "Invalid authentication credentials" in response_text
            )
            if is_auth_error and has_scope_or_credential_error:
                continue

            raise RuntimeError(
                f"Maya checkout verify failed ({status_code}). Please verify sandbox API keys/config. {response_text[:500]}"
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Maya checkout verify request failed: {exc}") from exc

    if last_exc is not None and isinstance(last_exc, httpx.HTTPStatusError):
        status_code = last_exc.response.status_code if last_exc.response is not None else 0
        response_text = last_exc.response.text[:500] if last_exc.response is not None else ""
        raise RuntimeError(
            f"Maya checkout verify failed ({status_code}). Please verify sandbox API keys/config. {response_text}"
        ) from last_exc

    raise RuntimeError("Maya checkout verify failed due to unknown authentication error.")


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    if not MAYA_WEBHOOK_SECRET:
        return True
    if not signature:
        return False

    computed = hmac.new(
        MAYA_WEBHOOK_SECRET.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    provided = signature.strip().lower().replace("sha256=", "")
    return hmac.compare_digest(computed.lower(), provided)


def compact_json(data: Dict[str, Any]) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
