# Early-Access Sign-Up — Implementation Notes

Public, unauthenticated early-access lead capture for Tabula Medica
(domain: **tabulamedica.us**). Added ahead of launch so prospective patients and
clinicians can register interest before the gated app is generally available.

## Where it lives

- **Route:** `/signup` (public — reachable without login)
- **Page:** `client/src/pages/signup.tsx` (component `EarlyAccessSignup`)
- **Logic/util:** `client/src/lib/signup-queue.ts`
- **Wiring:** `client/src/App.tsx`
  - Lazy-loaded route `<Route path="/signup" component={EarlyAccessSignup} />`
  - Added `"/signup"` to `publicAuthRoutes` so it renders when signed out
  - Page title entry `"/signup": "Request Early Access"`
- **Retry-flush on load:** `client/src/main.tsx` calls `flushSignupQueue()` at startup
- **Discovery links:** nav "Early access" button + footer "Early Access" link on
  `client/src/pages/landing.tsx`

## Fields

| Field | Required | Notes |
|-------|----------|-------|
| Full name | Yes | |
| Email | Yes | Validated (`isValidEmail`) |
| Phone | Yes | Validated (`isValidPhone`, 10–15 digits) |
| Role | Yes | Toggle: "Patient / Member" vs "Provider / Clinician" |
| Practice / organization | No | Shown only when role = Provider |
| Consent | Yes | Exact spec text; submit disabled until checked |

**Consent text (exact):**

> I consent to Tabula Medica contacting me about this service and storing the
> information I provide. I understand this is an early-access sign-up, not medical
> advice, and that no doctor–patient relationship is created. I can withdraw at any
> time.

## Fail-safe submit flow

1. **Persist first.** On submit the entry is written to `localStorage` under the
   key **`tm_signup_queue`** *before* any network call — a lead is never lost.
2. **Attempt delivery.** There is no generic lead/signup API in this repo (the only
   `/patient-signup` route is a discount-membership stub, not a lead sink), so we
   POST JSON to **`import.meta.env.VITE_SIGNUP_ENDPOINT`** when that env var is set.
3. **On failure / no endpoint.** The entry stays queued (`status: "queued"`), the UI
   **still shows success**, and a prefilled **`mailto:hello@tabulamedica.us`** link is
   offered as a manual fallback. Queued entries are retried via `flushSignupQueue()`
   on the next app load (and again when the `/signup` page mounts). Delivered entries
   are marked `status: "sent"` and are not re-sent.

## Configuration

Set the delivery endpoint via environment variable (do **not** commit real values):

```
VITE_SIGNUP_ENDPOINT=https://your-lead-endpoint.example/collect
```

Expected POST body:

```json
{
  "fullName": "…",
  "email": "…",
  "phone": "…",
  "role": "patient | provider",
  "organization": "… | null",
  "consent": true,
  "consentText": "…",
  "submittedAt": "ISO-8601",
  "source": "early-access-signup"
}
```

If unset, the flow degrades gracefully to the localStorage + mailto fallback.

## Privacy / PHI

- **No PHI or medical data** is collected, stored, or transmitted — only contact and
  role/intent details plus the consent record.
- The page copy explicitly asks people not to include medical details.
- Consent is required and recorded (text + timestamp) with each entry; the copy
  states this is an early-access sign-up, not medical advice, and creates no
  doctor–patient relationship, and that the person can withdraw at any time.

## Accessibility

- Labeled inputs, `aria-required` / `aria-invalid` / `aria-describedby` on fields
- Inline errors via `role="alert"`; focus moves to the first invalid field
- Role toggle implemented as an ARIA `radiogroup` inside a `<fieldset>`/`<legend>`
- `aria-live="polite"` status region announces submitting/received states
- Success panel is focusable (`tabIndex={-1}`) and receives focus on completion
- Fully keyboard operable; submit disabled (and `aria-disabled`) until consent
