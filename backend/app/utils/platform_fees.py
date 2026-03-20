from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict

from sqlalchemy import text
from sqlalchemy.orm import Session

DEFAULT_PLATFORM_FEE_PERCENTAGE = Decimal("7.00")
_MIN_PLATFORM_FEE = Decimal("0.00")
_MAX_PLATFORM_FEE = Decimal("100.00")


def _normalize_percentage(value) -> Decimal:
    try:
        percentage = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        percentage = DEFAULT_PLATFORM_FEE_PERCENTAGE

    if percentage < _MIN_PLATFORM_FEE:
        return _MIN_PLATFORM_FEE
    if percentage > _MAX_PLATFORM_FEE:
        return _MAX_PLATFORM_FEE
    return percentage


def _ensure_table(db: Session) -> None:
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS platform_settings (
            id INTEGER PRIMARY KEY,
            post_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 7.00,
            direct_hire_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 7.00,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    ))
    db.execute(text(
        """
        INSERT INTO platform_settings (id, post_fee_percentage, direct_hire_fee_percentage)
        VALUES (1, 7.00, 7.00)
        ON CONFLICT (id) DO NOTHING
        """
    ))


def get_platform_fee_settings(db: Session) -> Dict[str, Decimal]:
    _ensure_table(db)
    row = db.execute(text(
        """
        SELECT post_fee_percentage, direct_hire_fee_percentage
        FROM platform_settings
        WHERE id = 1
        """
    )).fetchone()

    if not row:
        return {
            "post_fee_percentage": DEFAULT_PLATFORM_FEE_PERCENTAGE,
            "direct_hire_fee_percentage": DEFAULT_PLATFORM_FEE_PERCENTAGE,
        }

    return {
        "post_fee_percentage": _normalize_percentage(row.post_fee_percentage),
        "direct_hire_fee_percentage": _normalize_percentage(row.direct_hire_fee_percentage),
    }


def get_post_fee_percentage(db: Session) -> Decimal:
    return get_platform_fee_settings(db)["post_fee_percentage"]


def get_direct_hire_fee_percentage(db: Session) -> Decimal:
    return get_platform_fee_settings(db)["direct_hire_fee_percentage"]


def update_platform_fee_settings(
    db: Session,
    *,
    post_fee_percentage,
    direct_hire_fee_percentage,
) -> Dict[str, Decimal]:
    _ensure_table(db)

    post_fee = _normalize_percentage(post_fee_percentage)
    direct_hire_fee = _normalize_percentage(direct_hire_fee_percentage)

    db.execute(text(
        """
        UPDATE platform_settings
        SET
            post_fee_percentage = :post_fee_percentage,
            direct_hire_fee_percentage = :direct_hire_fee_percentage,
            updated_at = NOW()
        WHERE id = 1
        """
    ), {
        "post_fee_percentage": post_fee,
        "direct_hire_fee_percentage": direct_hire_fee,
    })

    return {
        "post_fee_percentage": post_fee,
        "direct_hire_fee_percentage": direct_hire_fee,
    }
