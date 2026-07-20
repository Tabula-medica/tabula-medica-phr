# NoorJyoti — "open app → nothing" fix + Clerk→GCIP migration
_2026-07-20. Branch `feat/gcip-auth`. Clerk is FULLY removed (backend + web). NOT deployed._

## Why the app showed nothing (both now fixed in code)
1. **The reader app was never deployed** — the Cloud Run image built/served only the Astro marketing site + API; `artifacts/web` (the React reader) was excluded → every reader route 404'd.
2. **The React app crashed at load** — `App.tsx` `throw`s on the missing Clerk key + wrapped everything in ClerkProvider (Replit proxy dead) → blank `#root`.

## ✅ DONE (committed on `feat/gcip-auth`; NOT deployed)
- **Backend Clerk→GCIP** (`18ecbb5b`, `a935f919`): `middlewares/gcipAuth.ts` mints/verifies a first-party httpOnly **`nj_session` cookie** (firebase-admin `createSessionCookie`/`verifySessionCookie`); `resolveGcipUser` (app-wide, non-blocking) sets `req.gcipUid`; `requireAuth`/`resolveUserOrAnon` read it (anon-quota intact); admin user-mgmt moved Clerk-API→firebase-admin; new `routes/auth.ts` (`/api/auth/session` + `/logout`); Clerk removed from `app.ts` + proxy deleted; quota test rewired; deps `@clerk/*`→`firebase-admin`. Cookie transport chosen so the existing cookie-based api-client works unchanged.
- **Frontend Clerk→GCIP** (`a935f919`): new `lib/firebaseAuth.ts` + `lib/auth.tsx` (`GcipAuthProvider` + `useAuthState`; session cookie kept in lock-step with Firebase auth state); `App.tsx` crash + ClerkProvider removed → GCIP email/password login pages; `navbar` + `home`/`scripture`/`listen`/`admin` swapped `useUser`/`useClerk`/`Show`/`SignInButton` → `useAuthState`; deps `@clerk/*`→`firebase`; `index.css` clerk layer removed. **No third-party login vendor remains.**
- **Deploy wiring** (`05f1d586`): Dockerfile now builds `@workspace/web` (`BASE_PATH=/app/` → `artifacts/web/dist/public`); `deploy/server.mjs` serves it at **`/app`** with SPA fallback. Astro marketing stays at `/`.

## ⏭️ REMAINING — founder steps before/at deploy (test-before-deploy)
1. **Provision a GCIP (Identity Platform) project** for NoorJyoti + an admin user (email/password). Enable Email/Password provider.
2. **Set env** (Cloud Run + build): `FIREBASE_PROJECT_ID`, `ADMIN_EMAILS` (admin's email), `ADMIN_USER_IDS` (admin's Firebase UID — used by `isAdminUser` for /admin content), and build-time `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID`. Grant the Cloud Run runtime SA session-cookie mint/verify (Identity Toolkit).
3. **Test-build the image** — the web `vite.config.ts` imports `@replit/vite-plugin-runtime-error-modal` at top level; confirm the filtered install + build succeed in the `linux/amd64` container (this is the main build risk; the plugin should no-op in a prod build).
4. **Deploy**, then open **`/app`** — confirm the reader renders, email/password sign-in works, `/app/library` loads, and `/admin` gates on the allowlist. The marketing site is still at `/`.
5. **Link the marketing CTA** (ekdharma-site homepage) to `/app` so visitors reach the reader. *(Product choice: if you'd rather the reader BE the root site instead of `/app`, flip `BASE_PATH=/app/`→`/` in the Dockerfile and serve `webDir` with a root SPA fallback instead of Astro — reversible one-liner.)*

## Still separate (not in this branch)
- **Mobile Expo app** (`artifacts/mobile`) still uses Clerk incl. `SocialAuthButtons` (third-party login UI to remove). Same GCIP pattern; separate pass.

Reference pattern: UHR (`Desktop/health-radio`, branch `feat/gcip-admin-auth`, `d649d60`).
