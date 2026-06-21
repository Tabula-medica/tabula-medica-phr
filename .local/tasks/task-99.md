---
title: Sign in with Apple
---
# Sign in with Apple

## What & Why
Add "Sign in with Apple" as a second identity provider alongside Google through Google Cloud Identity Platform. Required by App Store guideline 4.8 for iOS submission if any other social sign-in is offered, and a preferred option for patients in the Apple ecosystem who want to keep their email private via Apple's hide-my-email relay.

## Done looks like
- Login and registration pages show a second button "Continue with Apple" under "Continue with Google", styled per Apple's HIG (black button, Apple logo, correct corner radius).
- Clicking it triggers the Apple OAuth flow via GCIP, returns to the app, and resolves to the same signed-in patient state Google produces.
- A new Apple account that has never signed in creates a new patient record; an existing Google patient who later signs in with Apple using the same verified email is linked to the existing account (not duplicated).
- Apple's hide-my-email relay addresses are accepted and stored as the canonical email.
- Sign-in works in web (PWA), Capacitor wrapper, and is ready to wire into native iOS via Expo (mobile follow-up tracks the native side).
- Auth audit log records Apple sign-in events with provider = `apple.com`.

## Out of scope
- Native Sign in with Apple via the iOS system sheet inside the Expo app (separate mobile follow-up; this task delivers the web/Capacitor flow).
- Account-merge UX for the case where a user already has separate Google and Apple accounts with different emails (defer until a real user hits it).
- Removing or unlinking Apple as a provider from the user's account (future Security-page work).

## Steps
1. **Apple Developer prerequisites (USER)** — Out-of-band setup the user must complete before code can be tested: enroll in Apple Developer Program, create a Services ID for the web flow, enable "Sign In with Apple" capability, register the production return URL (`https://<gcip-auth-domain>/__/auth/handler`), generate a Sign in with Apple private key, and supply the resulting `Services ID`, `Team ID`, `Key ID`, and `.p8` key contents to the Firebase Console. This task is blocked on these credentials.
2. **GCIP provider config** — In the Firebase / GCIP console for project `united-planet-485003-n7-9f345`, enable the Apple provider and paste the Services ID + Team ID + Key ID + private key from step 1.
3. **Client integration** — Add `OAuthProvider("apple.com")` to the GCIP helper, scope to `email name`, render the Apple button on both auth pages, handle the same success/error paths Google uses.
4. **Email linking** — Ensure that when the Apple email matches an existing patient's verified email, the providers are linked into one account rather than creating a duplicate. Use the existing `external_identities` table with `provider = 'apple.com'`.
5. **Hide-my-email handling** — Accept and persist relay addresses (`@privaterelay.appleid.com`) as the user's email; do not attempt to resolve to a real address.
6. **Audit + tests** — Emit audit events for Apple sign-in / sign-up; add E2E coverage matching the Google paths.

## Relevant files
- `client/src/lib/gcip.ts`
- `client/src/pages/auth-login.tsx`
- `client/src/pages/auth-register.tsx`
- `server/auth/gcip.ts`
- `shared/models/auth.ts`

## Architectural constraints
- Do NOT change `VITE_GCIP_AUTH_DOMAIN` from `united-planet-485003-n7-9f345.firebaseapp.com` — the Apple return URL must be registered against that same domain, and changing it breaks the existing Google flow.
- Apple email relay addresses are PII like any other email — same encryption + handling rules as today.
- The existing `external_identities` table and `provider` column must be reused (not replaced) so legacy ownership records continue to resolve.
- Apple's Services ID, Team ID, Key ID, and private key are secrets — they must live only in the Firebase Console for the GCIP provider, never in this repo, never in env vars, never in logs.
- This task is blocked at step 1 until the user supplies the Apple Developer credentials; do not attempt to "stub" Apple sign-in client-side without them — it will fail at runtime and confuse future debugging.