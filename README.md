# API Proxy Admin

Next.js administration client for the Laravel API Proxy. Human administrators authenticate with Laravel Fortify and Sanctum session cookies. Machine bearer tokens are only displayed once and are never stored in browser storage.

The dashboard provides:

- Service-account creation, editing, activation, and deactivation.
- Scoped API-token creation, replacement, expiration visibility, and revocation.

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
