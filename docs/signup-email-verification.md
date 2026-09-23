# Sign-up email verification (and why there's no mandatory MFA)

## The problem this solves

Registration needed *some* proof that a new account belongs to a person rather
than a script. The obvious lever — force MFA enrolment at sign-up — is the wrong
one for a patient PHR: it blocks people who don't have an authenticator app,
it's an ongoing tax on every future sign-in, and when the second-factor message
doesn't arrive the user is locked out of their own records with no self-service
way back in.

So the anti-bot control is a **one-time email round-trip** instead:

- A new email/password account is not provisioned until the person opens the
  verification link GCIP mails them. A script can POST the sign-up form; it
  cannot read the inbox.
- **MFA (TOTP) remains entirely optional.** It is opt-in from
  Settings → Security (`/api/auth/mfa/*`); nothing forces enrolment, and no
  sign-in path demands a second factor unless the account has one enrolled.

## What changed

| Sign-in method | Gated? | Why |
|---|---|---|
| Email + password (`password`) | **Yes** | The address is whatever the user typed. Needs the round-trip. |
| Google (`google.com`) | No | Token arrives with `email_verified: true` from Google. |
| Apple (`apple.com`) | No | Same — including "hide my email" relay addresses. |
| Phone / SMS (`phone`) | No | Possession of the SMS code is the proof; there's no email on the token. |

### Server

- `server/auth/email-verification.ts` — dependency-free predicate
  `requiresEmailVerification(claims)` plus the shared `email_not_verified` code
  and user-facing message. Unit-tested in `tests/email-verification-gate.spec.ts`.
- `server/auth/gcip.ts` — `verifyAndResolveGcip()` refuses to **create** a user
  from an unverified password token. The check sits on the create path only,
  *after* `resolveGcipUser()`, so **anyone who already has an account is
  unaffected** — turning this on cannot lock out existing users.
- `POST /api/auth/gcip/session` and `POST /api/mobile/auth/gcip/session` answer
  `403 { code: "email_not_verified" }` instead of a generic 401, so the client
  can render "check your inbox" rather than "sign-in failed".

### Client

- `client/src/lib/gcip.ts` — `sendGcipVerificationEmail()`,
  `refreshGcipEmailVerified()`, `needsEmailVerification()`,
  `getGcipCurrentEmail()`.
- `client/src/pages/auth-register.tsx` — after sign-up, mails the link and shows
  a "Confirm your email" panel (resend with a 30s cooldown, "I've confirmed my
  email", "Use a different email"). No session is exchanged until confirmed.
- `client/src/pages/auth-login.tsx` — the same panel if an unconfirmed
  email/password account tries to sign in, or if the server returns the 403.
  Landing back on `/auth/login?verified=1` shows a confirmation notice.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `REQUIRE_SIGNUP_EMAIL_VERIFICATION` | on | Set to `false` (or `0`/`no`/`off`) to disable the gate without a code rollback — e.g. if outbound mail is broken. |

## Ops prerequisites (Firebase / GCIP console, project `united-planet-485003-n7-9f345`)

Verification mail is sent **by GCIP**, not by our Resend integration, so these
console settings decide whether it arrives:

1. **Authentication → Templates → Email address verification** — must be
   enabled, with a sender the domain actually authorizes.
2. **Authentication → Settings → Authorized domains** — every serving domain
   (`tabulamedica.us`, `.world`, `.health`, `localhost`) must be listed, or the
   `?verified=1` continue URL is rejected with
   `auth/unauthorized-continue-uri`.
3. If mail is sent from a custom domain, its **SPF/DKIM** records must be in
   place or the messages land in spam (a common cause of "the code/link never
   arrived").

## Related: someone locked out by an MFA factor they can't use

Disabling mandatory MFA does not unenroll a factor already attached to an
account in GCIP. If a user has TOTP enrolled and can no longer produce codes,
they need either a recovery code (Settings → Security issues them at enrolment)
or an admin unenroll in the Firebase/GCIP console — no code change removes an
already-enrolled factor.
