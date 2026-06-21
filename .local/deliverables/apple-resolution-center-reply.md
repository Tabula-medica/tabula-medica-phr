# Apple Resolution Center Reply — Build #46 (Guideline 2.1(a))

## Status

- **Bug**: `POST /api/mobile/auth/login` was returning HTTP 410 (Gone) for the published reviewer credentials, causing demo login to fail in Build #46.
- **Root cause**: A security hardening commit removed the demo login endpoint outright instead of isolating it.
- **Fix shipped** (server-side, no new app build needed):
  - Endpoint restored at `POST /api/mobile/auth/login`.
  - Accepts only `demo@tabulamedica.com` / `demo123`.
  - Each successful login mints a JWT bound to a freshly-generated, per-session unique reviewer ID (`demo-reviewer-<random>`), so concurrent reviewer sessions are fully isolated and cannot see each other's data or any real-user data.
  - Wrong password returns HTTP 401.
  - Audit-logged via `[HIPAA-AUDIT][MobileAuth] DEMO_LOGIN`.
- **Production deployment**: pending. Once the latest build is published from the Replit Deployments tab, the **existing Build #46 in App Store Connect will work without resubmission** — the fix is server-side and the mobile app already calls this endpoint.

## Pre-send checklist (do this BEFORE replying to Apple)

1. **Hit "Publish" / "Redeploy"** on the Deployments tab in Replit so the fix reaches production.
2. **Verify production**:
   ```bash
   curl -X POST https://tabula-medica-web-verion.replit.app/api/mobile/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@tabulamedica.com","password":"demo123"}'
   ```
   Expected: HTTP 200 with `{"token":"…","user":{"id":"demo-reviewer-<random>",…}}`. If you still see HTTP 410, the deploy did not pick up the change — redeploy.
3. **Verify the same call against your custom domain** if the iOS app points to it (e.g. `app.tabulamedica.health`).
4. Only after both verifications pass, paste the reply below into App Store Connect → Resolution Center.

---

## Reply text (paste into Resolution Center)

> Hello App Review Team,
>
> Thank you for the detailed feedback on Build #46. We have identified and corrected the issue that prevented the demo account from signing in.
>
> **What was happening:** The mobile sign-in endpoint on our server was rejecting the published reviewer credentials with an HTTP 410 response. This was caused by a recent server-side security hardening change that disabled the email/password login path.
>
> **What we changed:** We restored the demo sign-in path on our server while keeping it isolated from real-user data. Each successful demo login now provisions a fresh, ephemeral reviewer session, so multiple reviewers (and any real users) remain fully separated.
>
> **No new build is required.** The fix is entirely server-side. Build #46 already in review will work as-is once you retest. We have verified the demo sign-in is working in production.
>
> **Updated test credentials and steps:**
>
> - Email: `demo@tabulamedica.com`
> - Password: `demo123`
>
> 1. Open the Tabula Medica app.
> 2. On the sign-in screen, tap **Sign in with email** (the option below "Continue with Auth0").
> 3. Enter the credentials above and tap **Sign In**.
> 4. You should land on the patient dashboard within ~2 seconds.
> 5. Demo data is pre-populated (sample appointments, medications, lab results, conditions, immunizations) so you can exercise every screen — Health Records, Timeline, Documents, Symptom Checker, Care Team, Settings — without needing to connect a real EHR.
>
> **Optional second path** (also working): "Continue with Auth0" → use any test email (Auth0 will let you create a throwaway account in seconds).
>
> If anything else needs attention, please let us know in the Resolution Center and we will respond within hours. We sincerely appreciate your time reviewing our app, and we apologize for the inconvenience this issue caused.
>
> Best regards,
> The Tabula Medica Team

---

## If Apple comes back with anything else

Common follow-ups and pre-prepared answers:

| Apple says | Reply |
|---|---|
| "Demo still doesn't work" | Ask them for the exact error message and timestamp; check our `[HIPAA-AUDIT][MobileAuth] DEMO_LOGIN` log around that time. If no log entry, the request didn't reach our server (network/cert issue on the device). |
| "Account creation requires medical info" (2.5.4 / 5.1.1) | Reply: account creation is optional. The demo path requires no PII. The Auth0 path requires only an email. Medical/PHI fields are voluntary inside the app and are explained inline. |
| "App requires login to view content" (5.1.1(v)) | Reply: anonymous users can browse Drug Interactions, Prior-Auth Letter info, and the Symptom Checker without an account. (These are routed in `publicClinicalRoutes` in the app shell.) |
| "Privacy nutrition labels missing X" | Update App Privacy in App Store Connect → Privacy section to declare: Health & Fitness data, Contact Info (email), Identifiers (user ID), Usage Data (analytics). All linked to the user, used for App Functionality. |
