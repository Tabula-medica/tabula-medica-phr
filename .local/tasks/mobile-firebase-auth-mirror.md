# Mirror Web Firebase Auth on Mobile

## What & Why
The Expo React Native app in `tabula-medica-mobile/` needs Firebase authentication that mirrors the web app's setup exactly — same Firebase project, same login flows, and compatible bearer tokens so existing backend endpoints accept mobile requests without changes.

The web auth implementation lives in a separate repo, which the user has dropped into `exports/` as a zip. The build agent should unpack the reference zip, read the relevant auth files, and port the pattern into the mobile app.

## Done looks like
- A user can sign in on the mobile app using the same Firebase credentials that work on the web app.
- The mobile client obtains a Firebase ID token (or whatever access token the web client uses) and attaches it to backend API requests in the same header format the server already expects.
- The existing server-side token-verification middleware accepts mobile requests with no server changes required (or, if a small change is unavoidable, it is called out explicitly and gated to preserve current web behavior).
- Sign-out clears local auth state and protected screens redirect unauthenticated users to the login screen.
- Firebase SDK versions on mobile are compatible with the versions pinned in the web repo's `package.json`.

## Out of scope
- Any changes to the web client or to existing server auth/middleware behavior beyond what is strictly required for mobile compatibility.
- New auth providers, MFA flows, or account-management screens that don't already exist on the web app.
- Production Firebase project provisioning or secret rotation — reuse the existing project configuration.
- Native build / EAS submission changes beyond what's needed for Firebase to function in Expo.

## Steps
1. **Unpack and inventory the web auth reference.** Extract the relevant zip from `exports/` into a scratch location outside the mobile source tree. Identify and read:
   - The server-side Firebase Admin setup (e.g. `server/auth/firebase*.ts` or equivalent).
   - The server-side token-verification middleware (the web app's `requireAuth` equivalent).
   - The client-side Firebase init module and the login screen(s).
   - The web repo's `package.json` to capture exact `firebase` (and any `firebase-admin`) versions.
   Summarize the auth flow (provider, token type sent to backend, header name, refresh behavior) before writing any mobile code.

2. **Confirm backend compatibility.** Compare the web repo's server-side token verification against this workspace's current backend auth surface (referenced in `threat_model.md` — `server/auth/gcip.ts`, `server/replit_integrations/auth/replitAuth.ts`, and bearer handling in `server/mobile-api-routes.ts`). Determine whether the existing backend already verifies the same Firebase tokens or whether a minimal, gated addition is required. If a server change is required, scope it narrowly and document it in the task summary; do not loosen existing audience/issuer checks.

3. **Install and configure Firebase on the mobile app.** Add the Firebase JS SDK (matching the web repo's major version) to `tabula-medica-mobile/`, using Expo-compatible setup. Wire up the Firebase config using the same project credentials as web, sourced from environment/`app.config.js` rather than hard-coded.

4. **Implement the mobile login flow.** Build a login screen in `tabula-medica-mobile/src/` that mirrors the web login UX (same providers, same field set). On successful sign-in, persist the auth session using a React Native-appropriate persistence layer and expose the current user via a context/hook consumed across the app.

5. **Attach tokens to API calls.** Update the mobile API client so every authenticated request includes the Firebase ID token in the same header format the backend already accepts. Handle token refresh on 401s. Ensure unauthenticated requests do not silently fall back to a default identity.

6. **Gate protected screens and add sign-out.** Route unauthenticated users to the login screen, route authenticated users to the existing home/landing destination, and add a sign-out action that clears local auth state and returns the user to login.

7. **Verify end-to-end.** Run the mobile app against the existing backend and confirm: sign-in succeeds, an authenticated API call returns real data (not a fallback identity), sign-out works, and a fresh launch restores the prior session. Run `npm run typecheck` in both `tabula-medica-mobile/` and the workspace root.

## Relevant files
- `tabula-medica-mobile/App.tsx`
- `tabula-medica-mobile/app.config.js`
- `tabula-medica-mobile/package.json`
- `tabula-medica-mobile/src`
- `exports/tabula-medica-unified-source.zip`
- `exports/tabula-medica-source-20260426.tar.gz`
- `exports/tabula-medica-mobile-comparison.zip`
- `server/auth/gcip.ts`
- `server/replit_integrations/auth/replitAuth.ts`
- `server/mobile-api-routes.ts`
- `threat_model.md`
