# admin_main Quick Start (Windows)

Use this only for the `admin_main` branch.

## 1) Clone and checkout

```powershell
git clone https://github.com/Pejayy-10/casaligan_pwa.git
cd casaligan_pwa
git checkout admin_main
```

## 2) Confirm branch

```powershell
git branch --show-current
```

Expected output:

```text
admin_main
```

## 3) Install dependencies

Run in repo root first:

```powershell
npm install
```

## 4) Create env file

Create `.env.local` in repo root with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## 5) Start dev server

```powershell
npm run dev
```

Open:

- http://localhost:3000

---

## If you get 404

1. Verify branch:

```powershell
git branch --show-current
```

2. Verify `.env.local` exists and keys are correct.
3. Restart dev server after env changes:

```powershell
# stop server (Ctrl+C), then
npm run dev
```

4. Check browser DevTools > Network and copy the failing URL + response body.

---

## Note

`admin_main` does **not** require running a local `backend/` service.
