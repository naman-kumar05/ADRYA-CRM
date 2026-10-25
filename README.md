# ADYRA CRM

Operations CRM for leads, customers, dealers, vendors, finance cases, documents, follow-ups and payouts. The application is Django and PostgreSQL.

Python 3.11 or newer and PostgreSQL are required. The virtualenv, `.env`, and uploaded customer files are not in git. Each computer creates its own.

## First run after cloning

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
createdb adrya_crm
python manage.py migrate
python manage.py seed
python manage.py runserver
```

On Windows, create the virtualenv with `py -3 -m venv .venv`, activate it with `.venv\Scripts\activate`, and copy the sample env with `copy .env.example .env`.

Before `migrate`, edit `.env`:

- `DATABASE_URL` must use the Postgres role on that computer. Replace `YOUR_POSTGRES_USER`. Create the empty database `adrya_crm` first.
- Replace `SESSION_SECRET` and `INTAKE_API_KEY` with long private values. The intake key is what a website sends as `X-Api-Key` to `POST /api/intake/`. It stays on the server.

Open http://localhost:8000

Demo password for every seeded account: `Adrya@2026`

| Email | Role |
| --- | --- |
| admin@adrya.test | Super admin |
| amit@adrya.test | Sales executive (only assigned leads) |
| finance@adrya.test | Finance executive (only assigned cases) |
| accounts@adrya.test | Accounts |
| dealer@abctractors.test | Dealer (only ABC Tractors leads) |
| vendor@surya.test | Vendor (only Surya Solar leads) |

`python manage.py seed` loads that demo once. If `admin@adrya.test` already exists, it leaves the database alone. Replace these logins before any real customer file is stored.

## What is intentionally not in this build

Dealer and vendor portals as separate sites, WhatsApp or SMS delivery, a native mobile app, and AI scoring are later. The phone screens, click-to-call, and WhatsApp template links work now. The lender still makes the credit decision.
