# Mewar Sync — Audit, Hardening & Redesign Report

Date: 13 October 2026. Scope: the full repository (`main` at `06915dc` plus the working-tree changes described here), tested locally against the Firebase emulators. No production systems were tested or modified.

## 1. Application overview

| Area | Before | After |
| --- | --- | --- |
| Frontend | React 19 SPA, Vite 6, Tailwind via CDN script (custom colours undefined), single 1.79 MB bundle | Same stack; Tailwind 4 built at compile time with design tokens; route-level code splitting |
| Backend | None — the browser called Gemini directly with the API key compiled into the bundle | Express API (`server/`) holds the key, verifies Firebase ID tokens, checks roles, rate-limits, validates AI I/O, serves the app with CSP and security headers |
| Data | Firestore with **no security rules in the repo** | `firestore.rules` (deny-by-default, ownership, field allow-lists, validation) + `firestore.indexes.json` |
| Auth | Firebase email/password; role chosen by the client | Same provider; role restricted to SHOPKEEPER/VISITOR at sign-up, immutable afterwards |
| Types | `@types/react` missing — React code was effectively untyped | Strict TypeScript, zero errors |
| Tests | None | 115 automated tests (see §5) |

Features inspected: auth, artisan overview, ledger (business/personal), inventory, udhaar, reports/print, gallery, scan-to-list, settings, voice entry, messenger, help chatbot, visitor map/explore, artisan directory/profile, product view + authenticity check, translator, admin place photos.

Environment limitations: no Gemini key was used (the key in the repo is compromised, see C1), so live Gemini calls were not exercised; AI paths were tested with a deterministic mock provider and contract tests. Cloudinary uploads were not exercised against the real service. Production Firestore rules were not deployed or inspected.

## 2. Issues found and fixed

Severity: C = critical, H = high, M = medium, L = low. "Verified" names the test that covers the fix.

### Security

| # | Issue | Sev | Root cause → fix | Verified |
| --- | --- | --- | --- | --- |
| C1 | Gemini API key committed in `.env.example` (pushed to GitHub) and compiled into the client bundle via `vite.config.ts` `define` | C | Key moved server-side only; `define` removed; `.env.example` now placeholders; `.env` was not git-ignored — fixed. **The exposed key must be rotated** (still in git history). | Bundle scan: no Gemini key/SDK in `dist`; server tests |
| C2 | No Firestore security rules: any signed-in (or anonymous, depending on deployed rules) user could read/modify every artisan's ledger, inventory, chats and profiles | C | Wrote `firestore.rules`: per-artisan ownership, participants-only chat, private visitor profiles, field allow-lists, type/range/enum validation, default deny | 24 rules tests (BOLA, mass assignment, escalation, chat privacy) |
| C3 | Privilege escalation: client chose `role` at sign-up and could update it (e.g. to ADMIN) | C | Rules allow only SHOPKEEPER/VISITOR at create; `role`, `email`, `likes` not owner-editable | Rules tests "prevents privilege escalation" |
| H1 | Mass assignment: edits wrote the whole client object (`shop_id`, `is_verified`, `reviews`, `id`…) | H | Storage writes only allow-listed fields; rules restrict changed keys | Rules + integration tests |
| H2 | "VERIFIED CERTIFIED" badge on every product (client set `is_verified: true`) | H | New products are unverified; only admins can verify; badge shown only when verified | Rules test "never self-verify" |
| H3 | Stored XSS in printed ledger report (`document.write` with raw item/customer names) | H | All values HTML-escaped; no script in the print document | E2E "renders malicious text as plain text … printed reports" |
| H4 | Prompt injection / untrusted AI output used directly (AI could rename items, choose categories, set prices) | H | Instructions in system prompt, user text JSON-encoded as data, strict response schemas, server+client sanitisation and bounds; voice drafts always require human confirmation | Server test "bounds malicious model output"; E2E voice review |
| H5 | AI endpoints usable by anyone holding the key; no rate limits; arbitrary prompt topics (heritage endpoint) | H | Token verification (RS256, issuer, audience, expiry), role checks, per-user rate limits, body size limits, allow-listed place names | 17 server tests; E2E API authorisation |
| M1 | Account enumeration via distinct "user not found" / "wrong password" messages | M | Single generic message; password reset always responds the same | E2E auth tests |
| M2 | Chat sessions/messages readable and editable by anyone; spoofable names | M | Rules: participants only, sender-only edits, names must match profiles | Rules tests; E2E messaging |
| M3 | Anyone could like on behalf of others / overwrite likes arrays (read-modify-write) | M | `arrayUnion`/`arrayRemove`; rules allow toggling only your own uid | Rules tests |
| M4 | Unsigned Cloudinary uploads accepted any file type (`auto/upload`) with no size check | M | Image-only endpoint, client-side type/size validation and downscaling (preset restrictions must still be set in Cloudinary) | Manual review; E2E scan page |
| M5 | No CSP or security headers; Tailwind CDN script prevented a strict CSP | M | Build-time Tailwind; Helmet CSP (`script-src 'self'`, `frame-ancestors 'none'`, …), HSTS in production, Permissions-Policy | Server test checks headers |
| M6 | Spreadsheet formula injection risk in exports | M | New CSV export escapes `= + - @` cells | Unit + E2E CSV test |
| L1 | Image URLs from the database rendered without checks (`javascript:`/CSS `url()` injection) | L | `safeImageUrl` (https/blob only) and rules require https URLs | Unit + rules tests |

### Correctness and data integrity

| # | Issue | Sev | Fix | Verified |
| --- | --- | --- | --- | --- |
| D1 | Every ledger save called Gemini to "normalise" the item and **replaced the artisan's text with the AI output**; with no key, every save failed | H | Deterministic local normaliser; the user's text is stored unchanged | Unit tests; E2E sales |
| D2 | Ledger write and stock update were separate; failures/races left them inconsistent; concurrent sales could oversell | H | Single Firestore transaction with stock check | Integration "serialises concurrent sales" |
| D3 | Double taps/retries created duplicate entries | H | Idempotency key per form session (transaction checks the id) | Integration + E2E double-click |
| D4 | Editing a sale's item or deleting entries never reconciled stock | H | Edits reverse old and apply new stock movement; delete offers "put back into stock" | Integration + E2E edit/delete |
| D5 | Daily summaries always recorded ₹0 (date format mismatch) and could duplicate | M | Local date keys; deterministic `${uid}_${date}` ids | Integration test |
| D6 | "Total dues" mixed money owed to and by the artisan | M | Receivables vs payables shown separately | Unit tests |
| D7 | Udhaar settlement was two writes (could duplicate or lose data) | M | Transaction with same-id idempotency | Integration test |
| D8 | Amounts parsed with `parseInt` (paise lost); negative/zero/huge values accepted | M | Strict validation, 2-decimal rounding, bounds (client + rules) | Unit + E2E validation |
| D9 | Category could contradict type in voice entries | M | Category derived from type | Unit tests |
| D10 | Sign-up could leave an account without a profile (write lost on reload / failed write) | M | Roll back auth user on failure; app waits for server-confirmed profile | E2E tour (found during testing) |
| D11 | Visitor visiting an artisan URL crashed the map (error boundary) | M | Disallowed routes render nothing while redirecting | E2E "visitor cannot open artisan pages" |
| D12 | Profile listener could fail permanently right after sign-up | L | Retry with backoff | E2E |
| D13 | "Entry recognised" shown even when nothing was understood; voice errors silently swallowed | L | Clear states and messages; mic-permission guidance; typed fallback | E2E voice tests |
| D14 | Language change forced a full reload; no back/forward navigation | L | Live profile updates; hash routing | E2E keyboard/navigation |
| D15 | Dead/fake code (hard-coded analytics, fake story feed, unused duplicate voice flow) | L | Removed (unreachable; contained fabricated figures) | Typecheck/build |

## 3. Security audit summary

- **Authentication:** Firebase email/password; generic errors; 8+ char passwords with letters and digits (client); reset flow non-enumerating; Firebase handles session tokens and brute-force throttling. *Recommended:* enable email-enumeration protection and a password policy in the Firebase console.
- **Authorisation:** deny-by-default rules; per-artisan ownership on all business data; tenant isolation verified in rules, integration and E2E tests; API enforces roles server-side.
- **Input validation:** shared validators on the client, zod schemas on the API, and type/range/enum checks in rules.
- **Injection & XSS:** React escaping everywhere; print output escaped; CSV formula-safe; no `dangerouslySetInnerHTML`; CSP without inline scripts.
- **CSRF / CORS:** API uses bearer tokens (not cookies) and sends no CORS headers (same-origin only).
- **Secrets:** only server-side; `.env` git-ignored. **Action required:** rotate the Gemini key exposed in git history; restrict the Firebase browser key to your domains.
- **Files:** image types/sizes validated; uploads go to Cloudinary over an unsigned preset — restrict the preset (formats, max size) or move to signed uploads.
- **Dependencies:** pinned new dependencies; `npm audit` was not part of this run.

## 4. UI/UX redesign

- **Direction:** a premium, Apple-style light corporate interface with a quiet Udaipur identity — warm-grey canvas, white translucent (glass) surfaces with soft blur, gentle elevation, smooth hover and press feedback, and royal indigo as the single action colour. Antique gold appears only as fine hairlines, the sun-in-jharokha emblem and a barely-visible jaali lattice.
- **Less text:** eyebrows, subtitles and long descriptions removed across all pages; headings plus one short line only where it carries meaning (e.g. the AI disclaimers). The login screen is a single centred card: wordmark, Sign in / Create account, essential fields.
- **Tokens:** ink `#1D1D1F`, secondary grey `#6E6E73`, canvas `#F5F4F1`, white surfaces, indigo `#243B64`, antique gold `#C49A52`, plus maroon/sage/terracotta for meaning (money in/out, stock state) and semantic success/warning/danger. Radii 8–22 px, soft neutral shadows, 200–260 ms ease-out motion.
- **Type:** Inter (UI and headings, tabular numerals), Mukta (Devanagari), Eczar only for the wordmark — all self-hosted.
- **Components:** Button (pill-rounded, press feedback), IconButton, Field/Input/Select/MoneyInput (translucent fields, focus halo), SegmentedControl (iOS-style), Modal/ConfirmDialog (sheet-style, focus trap), Toast, Card (with `interactive` lift), StatTile, Badge, EmptyState, Avatar, SafeImage.
- **Shell:** translucent light sidebar with section labels and a tinted active pill; slim toolbar with messages and account menu; mobile drawer.
- **Accessibility:** labelled controls, error announcements, skip link, focus management, keyboard-operable dialogs and segmented controls, status never conveyed by colour alone, `prefers-reduced-motion` and `prefers-reduced-transparency`, opaque fallback without backdrop-filter.
- **Responsive:** verified with no horizontal overflow at 360, 390, 768, 1024, 1440, 1920 px.
- **Voice entry** is built and tested but hidden by default (`VITE_ENABLE_VOICE=true` to show).

## 5. Test results (all executed on 13 Oct 2026)

| Category | Tool | Tests | Passed | Failed |
| --- | --- | --- | --- | --- |
| Unit (money, ledger, inventory, voice, text) | Vitest | 42 | 42 | 0 |
| API server (auth, roles, validation, limits, headers) | Vitest + Supertest | 17 | 17 | 0 |
| Firestore security rules | Vitest + rules-unit-testing + emulator | 24 | 24 | 0 |
| Data layer integration | Vitest + Auth/Firestore emulators | 9 | 9 | 0 |
| End-to-end + responsive tour | Playwright (Edge) | 23 | 23 | 0 |
| Typecheck (strict) / production build | tsc / Vite | — | pass | — |

Not run: live Gemini calls (no valid key), real Cloudinary uploads, cross-browser Safari/Firefox, load testing, `npm audit`.

## 6. Remaining risks and required actions

1. **Rotate the Gemini API key** — it is in public git history. Consider rewriting history only after rotation.
2. **Deploy `firestore.rules` and indexes** (`npx firebase deploy --only firestore:rules,firestore:indexes`). Until then production data is protected only by whatever rules are currently deployed.
3. Existing production documents created before the rules may contain inconsistent fields; most are handled (normalisation on read/settle), but review data that was edited by the old client (e.g. extra `id` fields, legacy `is_verified: true`).
4. Unsigned Cloudinary preset is publicly usable — restrict it.
5. Artisan phone/email are readable by signed-in users (public shop listing by design). Split public/private profile data if that is not intended.
6. Place-photo limit (10) is enforced client-side only.
7. Full-ledger reads for date lists/reports grow with history; the composite index enables range queries, with a fallback scan until it is deployed.
