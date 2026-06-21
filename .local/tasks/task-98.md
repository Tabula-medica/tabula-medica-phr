---
title: MFA via TOTP (Authenticator App)
---
# MFA via TOTP (Authenticator App)

## What & Why
Add opt-in multi-factor authentication using time-based one-time passwords (TOTP) through Google Cloud Identity Platform. Strengthens account security for a HIPAA-grade health app without adding telco dependencies or per-message cost. TOTP is preferred over SMS for healthcare because there is no third-party carrier in the auth path and no PHI risk in the second factor.

## Done looks like
- Signed-in patients can enroll a TOTP authenticator (Google Authenticator, 1Password, Authy, etc.) from a new Security section in account settings.
- Enrollment shows a QR code + secret, asks the user to enter a 6-digit code to confirm, and surfaces 8 one-time recovery codes the user must save before finishing.
- On subsequent sign-ins, enrolled users are prompted for a 6-digit code after Google sign-in completes; recovery codes work as a fallback.
- Users can disable MFA (with confirmation) or regenerate recovery codes from the same Security section.
- All enroll / verify / disable / recovery-code-use events are written to the existing audit log.
- Works in both web (PWA) and the Capacitor wrapper; Expo mobile follow-up tracked separately.

## Out of scope
- SMS MFA, push MFA, WebAuthn / passkeys (separate future work).
- Org-level enforcement / admin policies that require all patients to enable MFA (v1 is opt-in only).
- MFA for provider / staff accounts beyond what falls out naturally from the patient flow.
- Native Expo (React Native) MFA UI — handled in a mobile follow-up.

## Steps
1. **GCIP tenant config** — Confirm Identity Platform tier supports MFA (it does), enable TOTP as a second-factor type, verify settings are reflected in the project used by the web client.
2. **Client enrollment flow** — Build the Security settings panel, the QR + manual-secret enrollment screen, the 6-digit confirmation step, and the recovery-codes display + acknowledgement step.
3. **Sign-in challenge flow** — After Google sign-in resolves, detect `multiFactor` requirement and prompt for the 6-digit code or a recovery code; route success back into the existing post-login flow.
4. **Recovery codes** — Generate, hash-store server-side, allow single-use consumption, and let the user regenerate (invalidating the previous set).
5. **Disable MFA** — Confirm flow that re-prompts for a fresh TOTP code before removing the enrolled factor.
6. **Audit logging** — Emit audit events for enroll, successful verify, failed verify, recovery-code use, regenerate, disable. Reuse the existing audit log writer; ensure no PHI in payload.
7. **Tests** — E2E tests for enroll, sign-in challenge, recovery-code consumption, disable.

## Relevant files
- `client/src/lib/gcip.ts`
- `client/src/pages/auth-login.tsx`
- `client/src/pages/auth-register.tsx`
- `server/auth/gcip.ts`
- `shared/models/auth.ts`

## Architectural constraints
- TOTP secrets and recovery codes are auth material — never log them, never include them in operational emails or alerts (operational email must remain PHI-free per existing project gotcha; the same rule extends to auth material).
- Recovery codes must be stored hashed (argon2 or bcrypt), never plaintext.
- Audit events must not contain the TOTP code itself, only the event type, user ref, timestamp, and outcome.
- All new routes for MFA management must enforce `isAuthenticated` and bind the operation to the authenticated subject (no caller-supplied user IDs) per the threat model.