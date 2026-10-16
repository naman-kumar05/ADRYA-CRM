# ADYRA CRM

Cloud-ready operations CRM for leads, customers, dealers, vendors, finance cases, documents, follow-ups and payouts.

## Run it locally

Postgres is already expected on `localhost:5432`, database `adrya_crm`.

```bash
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000

Demo password for every account: `Adrya@2026`

| Email | Role |
| --- | --- |
| admin@adrya.test | Super admin |
| amit@adrya.test | Sales executive (only assigned leads) |
| finance@adrya.test | Finance executive (only assigned cases) |
| accounts@adrya.test | Accounts |
| dealer@abctractors.test | Dealer (only ABC Tractors leads) |
| vendor@surya.test | Vendor (only Surya Solar leads) |

## What is intentionally not in this build

Dealer/vendor/customer portals as separate sites, WhatsApp/SMS delivery, a mobile app, and AI scoring are later versions. In-app alerts work now. Messaging providers can be added without changing the lead flow.
