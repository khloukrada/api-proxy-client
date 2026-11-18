# API Proxy Admin

Next.js administration client for the Laravel API Proxy. Human administrators authenticate with Laravel Fortify and Sanctum session cookies. Machine bearer tokens are only displayed once and are never stored in browser storage.

The dashboard provides:

- Service-account creation, editing, activation, and deactivation.
- Scoped API-token creation, replacement, expiration visibility, and revocation.
- NBC USD/KHR latest saved rate, freshness status, and paginated publication history.

## NBC Exchange Rates

Open **NBC Exchange Rates** in the administration menu (`/dashboard/nbc-exchange-rates`).
The page uses the administrator's existing Sanctum session to read
`GET /api/admin/nbc/exchange-rates`.

- The main card shows the saved average per published USD unit, with bid, ask, and publication date.
- Status uses the same freshness/expiry rules as the gateway. Expired values remain visible for reference; the gateway still rejects them as current rates.
- Publication dates remain unchanged, and check times display in `Asia/Phnom_Penh` (UTC+7).
- History supports inclusive From/To date filters and server pagination (10, 25, 50, or 100 rows). Filters do not change the latest-rate card.
- Reload only reads saved data. Empty storage and missing history dates never trigger NBC requests. The backend scheduler remains responsible for updates.
- **Sync now** requests an NBC update immediately while preserving the server's lock, cooldown, and failure backoff. A retry countdown is shown when the server asks you to wait.
- **Enter rate** opens a form for a date, KHR per 1 USD, and a required reason/source note. Bid, ask, and average receive the same entered value. The form asks you to review and explicitly replace an existing rate; concurrent changes require a new review.
- Manual rates are labelled **Manual**, show their author/note, and never claim an NBC check. They are available to gateway clients with manual source metadata. A successful NBC sync for that date replaces them, keeping the previous value in the backend audit table.
- **Revise** on a saved row (or **Revise this rate** on the main card) opens the exact current bid, ask, and average. Date and USD unit stay fixed; a reason is required. Saving creates a new manual revision. If another update happened, load the latest saved values and reapply the change.
- **Audit history** shows previous/new rates, the author or automatic sync, change timestamps including seconds in Cambodia time, and a details view with bid/ask/average and notes. Filter by author/note, change date, or change type, including **NBC replaced manual**. Each saved row's **Audit** button narrows the view to that rate date.
- Audit history contains recorded changes only; unchanged NBC checks do not add rows. Older records may lack an author. New audit records preserve author names even if accounts are later renamed or deleted.
- Status is evaluated when data is loaded; its evaluation time is displayed. Use Reload for a new status check.

Run the backend migrations (including `2026_11_18_000001_preserve_nbc_audit_actor_names.php`) and deploy the administrator endpoints before the updated frontend. Keep the NBC scheduler running. No new frontend dependency is required.

## Prerequisites

- Node.js >=22.12
- The Laravel backend running on `http://localhost:8000`

## Installation

```sh
npm ci
npm run dev
```

The app runs on `http://localhost:8083`.

Configure `.env`:

```dotenv
NEXT_PUBLIC_SERVER_URL=http://localhost:8000
NEXT_PUBLIC_ASSETS_DIR=
```

## Verification

```sh
npm run fm:check
npm run lint
npm run tsc:check
npm run build
```

## Production

Set `NEXT_PUBLIC_SERVER_URL` to the public Laravel URL at build time. Prefer serving the frontend and backend from the same origin; sibling subdomains are also supported when Laravel's Sanctum, CORS, and session-domain settings match the frontend hostname.
