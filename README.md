# Mewar Sync

Bahi-khata (ledger), inventory, udhaar (credit) and showroom for Udaipur's artisans — plus a heritage map, artisan directory, translator and authenticity check for visitors.

- **Web app:** React 19 + Vite 6 + Tailwind CSS 4 (design tokens in `styles/index.css`)
- **Data & auth:** Firebase Authentication + Cloud Firestore, protected by `firestore.rules`
- **API server:** Node/Express (`server/`) — the only place the Gemini key lives; verifies Firebase ID tokens, enforces roles and rate limits, validates AI output
- **AI:** Google Gemini (voice-to-ledger drafts, product descriptions, authenticity opinion, translation, help chat)

See [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) for the security audit, fixes and test results.

## Requirements

- Node.js **22.18+** (the API server runs TypeScript directly via Node's type stripping)
- Java 21+ only for running the Firebase emulators (tests)

## Setup

```bash
npm install
cp .env.example .env        # then edit .env
```

`.env` keys:

| Key | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | **Secret.** Server-side only. Without it, AI features return "not available" and everything else works. |
| `VITE_FIREBASE_*` | Firebase web config (public identifiers, not secrets). |
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | Unsigned image uploads. Restrict the preset to images + size limit in Cloudinary. |
| `VITE_ENABLE_VOICE` | `true` shows the microphone / voice-entry controls (hidden by default). |
| `PORT` | API server port (default 8787; Vite proxies `/api` to it in development). |
| `TRUST_PROXY` | Set (e.g. `1`) when running behind a reverse proxy. |

Never commit `.env` (it is git-ignored).

## Deploy Firestore rules and indexes (required)

The rules in `firestore.rules` are what keep each artisan's records private. They do nothing until deployed:

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes
```

Grant the `ADMIN` role only from the Firebase console or Admin SDK (set `role: "ADMIN"` on the user's `profiles/{uid}` document). Clients can never assign it.

## Run

```bash
npm run dev          # API server (with --watch) + Vite on http://127.0.0.1:3000
npm run build        # production build into dist/
NODE_ENV=production npm start   # serves dist/ and /api with security headers (CSP, HSTS, …)
```

If `npm run dev` says the API port is in use, another API server is running (possibly configured for a different Firebase project, which makes the app say "Please sign in again"). Stop it or change `PORT`.

## Tests

```bash
npm run typecheck          # strict TypeScript
npm test                   # unit + API server tests (Vitest)
npm run test:rules         # Firestore security rules against the emulator
npm run test:integration   # real data layer against Auth + Firestore emulators
npx playwright install chromium   # once (or set PW_CHANNEL=msedge / chrome)
npm run test:e2e           # Playwright end-to-end, incl. responsive tour 360–1920px
```

Emulator-based tests use the `demo-mewar-sync` project and never touch production data. End-to-end tests use a mock AI provider, which the server refuses to enable when `NODE_ENV=production`.

## Project layout

```
App.tsx, index.tsx        app shell, routing (hash-based), auth states
components/ui             design system: Button, Form, Modal, Toast, Surface, Ornaments, SafeImage
components/layout         AppShell (sidebar/top bar), context, error boundary
components/Artisan        Overview, Ledger, Inventory, Udhaar, Reports, Gallery, Scan to list, Settings
components/Visitor        Explore map, Artisans, Artisan profile, Product view
components/…              Messenger, Help chat, Translator, Authenticity check, Voice, Admin photos
lib/                      pure, tested domain logic (money, ledger, inventory, voice, dates, text)
services/                 Firebase init, storage (transactions), API client
server/                   Express API: auth, roles, schemas, AI providers, security headers
firestore.rules           backend authorization
tests/                    unit, server, rules, integration, e2e
```
