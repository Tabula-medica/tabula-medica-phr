# Payer-Token Storage — Sandbox Smoke-Test Runbook

This runbook closes the last gap left open by the automated coverage for the
`payer_token_connections` storage path (the encrypted per-user SMART-on-FHIR /
TEFCA payer tokens introduced when Auth0 `user_metadata` storage was retired).

It has two parts:

1. **Automatically verifiable (no external credentials needed)** — exercised
   against a live Postgres with the real migration applied. Run any time.
2. **Operator-gated live-sandbox smoke** — a one-time manual exchange against a
   real Cigna or Epic SMART sandbox. Requires sandbox client credentials and a
   human browser consent step, so it cannot run in CI or an isolated agent
   environment. Steps are written so an operator with the credentials can run it
   in ~15 minutes.

---

## Part 1 — Live-Postgres verification (automated, reproducible now)

This is the half of the original "optional" smoke that does NOT need a real
payer: it confirms the production storage path works against a real Postgres with
`migrations/0002_payer_token_connections.sql` actually applied (not the in-memory
drizzle stub the unit tests use).

```bash
# Requires a reachable Postgres at $DATABASE_URL and $PHI_ENCRYPTION_KEY set.
node --import tsx server/__tests__/payer-token-storage-integration.test.ts
```

Expected output (all checks `ok`):

```
[migrations] applied 0002_payer_token_connections.sql
  ok  migrationIsIdempotent
  ok  realRoundTrip
  ok  realUpsertHonorsUniqueConstraint
  ok  realConnectedSourcesIsUserScoped
  ok  realRefreshPayerToken
  ok  foreignKeyCascadeOnUserDelete
  ok  routePathsMatchProduction
  ok  routeEndToEnd
OK — payer-token storage end-to-end (real Postgres) holds
```

This test (and the in-memory `payer-token-storage.test.ts`) are wired into the
`npm run test:server` CI gate via `scripts/run-server-tests.mjs`.

### At-rest encryption evidence (captured live against real Postgres)

A token stored via `storePayerToken()` lands in `payer_token_connections` as
AES-GCM ciphertext in the `iv:authTag:ciphertext` format — never plaintext:

```
source_type            : cigna
fhir_base_url          : https://fhir.cigna.com/PatientAccess/v1-devportal/
access_token_encrypted : 87754b42999e759ee8cc5c89:cb8c34c7ec3b45da29a35f4a22beae3b:58e9049b0e4ff...
refresh_token_encrypted: 093b2d8b7da2fde4f762e246:bd0417b38dfd2e262c9b7ea6cbe28616:9977a76c705f6a...
plaintext present?     : false
ciphertext segments    : 3 (iv:authTag:ciphertext)
accessToken decrypts ok: true   (broker getPayerToken round-trips back to plaintext)
```

You can reproduce the raw-row inspection directly:

```sql
SELECT source_type, fhir_base_url,
       access_token_encrypted, refresh_token_encrypted,
       expires_at, connected_at
FROM payer_token_connections
WHERE user_id = '<internal users.id>';
```

The `access_token_encrypted` / `refresh_token_encrypted` columns MUST be three
colon-separated hex segments and MUST NOT contain the plaintext token. If you
ever see a raw bearer token here, stop — the encryption layer regressed.

---

## Part 2 — Live-sandbox OAuth smoke (operator-gated, one-time)

> **Why this is manual.** A real authorization-code-exchange requires (a) a
> registered sandbox `client_id` / `redirect_uri` that are deliberately NOT
> committed to the repo, and (b) a human logging into the payer's sandbox
> patient portal and clicking "Authorize." Neither can be done from CI or an
> isolated automation environment. Run this once, by hand, before the first
> real-patient connection.

### Routes involved

There is **no** literal `/api/fasten/connect-payer` route (the task brief used a
loose name). The real wiring is:

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET  /api/fasten/begin-connect` | `requireAuth` | Mint a connect-session nonce |
| `GET  /api/fasten/callback` | session (optional) | OAuth redirect target; calls `exchangeAuthCode()` and binds the connection to the user |
| `POST /api/fasten/store-payer-token` | `requireAuth` | Persist the access/refresh tokens (encrypted) into `payer_token_connections` |
| `GET  /api/fasten/connected-sources` | `requireAuth` | List the user's connected `sourceType`s |

`storePayerToken` / `getConnectedSources` / `refreshPayerToken` live in
`server/auth0-fhir-broker.ts`. The broker reports "configured" only when
`AUTH0_DOMAIN` is set (it is the OIDC issuer for the upstream Fasten broker; no
Auth0 Management API call is made — that path was retired).

### Prerequisites (fill in before starting)

| Item | Cigna sandbox | Epic SMART sandbox |
| --- | --- | --- |
| Authorize URL | `https://p-hi2.digitaledge.cigna.com/.../authorize` | `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize` |
| Token URL | `https://oauth.cigna.com/oauth2/token` (see `getTokenEndpointForSource`) | `<fhirBaseUrl>/oauth2/token` (derived from Epic base) |
| `client_id` | _from Cigna developer portal app_ | _from `fhir.epic.com` "Build Apps"_ |
| `redirect_uri` | _registered redirect, e.g._ `https://<host>/api/fasten/callback` | use the value in `EPIC_REDIRECT_URI` |
| FHIR base URL | `https://fhir.cigna.com/PatientAccess/v1-devportal/` | `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` |
| Sandbox test patient | Cigna sandbox login | Epic sandbox login (e.g. `fhirderrick` / Epic-provided creds) |

> Store `client_id` / `client_secret` as deployment secrets — never in the repo.
> For `refreshPayerToken` to find the client id for source `<X>`, set the env var
> `SMART_<X>_CLIENT_ID` (e.g. `SMART_CIGNA_CLIENT_ID`); `getTokenEndpointForSource`
> already knows the Cigna/Epic token endpoints.

### Steps

1. **Authenticate to the app** and capture a session token (or use a GCIP/Firebase
   JWT). Export it: `export TOK=...`. Set `export API=https://<your-host>`.

2. **Build the authorize URL** for the sandbox and open it in a browser:

   ```
   <authorize-url>?response_type=code
     &client_id=<client_id>
     &redirect_uri=<redirect_uri>
     &scope=launch/patient openid fhirUser offline_access patient/*.read
     &state=<random>
     &aud=<fhir-base-url>
   ```

   `offline_access` is required so the token response includes a `refresh_token`
   (otherwise step 6 cannot be exercised).

3. **Log in as the sandbox test patient and authorize.** The browser is
   redirected to `redirect_uri?code=<AUTH_CODE>&state=<state>`. Copy `AUTH_CODE`.

4. **Exchange the code for tokens** at the sandbox token endpoint:

   ```bash
   curl -sS -X POST "<token-url>" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d grant_type=authorization_code \
     -d code="<AUTH_CODE>" \
     -d redirect_uri="<redirect_uri>" \
     -d client_id="<client_id>"
   # → { "access_token": "...", "refresh_token": "...", "expires_in": 3600, ... }
   ```

5. **Store the tokens** through the production route (this is the line that
   writes the encrypted row):

   ```bash
   curl -sS -X POST "$API/api/fasten/store-payer-token" \
     -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
     -d '{
       "sourceType": "cigna",
       "accessToken": "<access_token>",
       "refreshToken": "<refresh_token>",
       "expiresAt": 0,
       "fhirBaseUrl": "https://fhir.cigna.com/PatientAccess/v1-devportal/"
     }'
   # → { "stored": true, "sourceType": "cigna" }
   ```

6. **Confirm it is listed:**

   ```bash
   curl -sS "$API/api/fasten/connected-sources" -H "Authorization: Bearer $TOK"
   # → { "sources": ["cigna"], "configured": true }
   ```

7. **Verify ciphertext at rest** (connect to the prod DB read-only) with the SQL
   in Part 1. Confirm `plaintext present? = false` and 3 hex segments.

8. **Exercise the real refresh** against the live token endpoint. Either let an
   access token expire and trigger a FHIR read, or call `refreshPayerToken` in a
   one-off script with `SMART_CIGNA_CLIENT_ID` set:

   ```bash
   AUTH0_DOMAIN=$AUTH0_DOMAIN SMART_CIGNA_CLIENT_ID=<client_id> \
   node --import tsx -e '
     const { refreshPayerToken, getPayerToken } = await import("./server/auth0-fhir-broker.ts");
     const before = await getPayerToken("<userId>", "cigna");
     const r = await refreshPayerToken("<userId>", "cigna");
     console.log("rotated:", !!r && r.accessToken !== before.accessToken);
   '
   ```

   Re-run the SQL from step 7 and confirm `access_token_encrypted` changed
   (ciphertext rotated in place — still one row, upsert on `(user_id, source_type)`).

### Pass criteria

- [ ] Step 5 returns `stored: true`.
- [ ] Step 6 lists the new source.
- [ ] Step 7 shows ciphertext (3 hex segments), no plaintext token.
- [ ] Step 8 rotates the stored access-token ciphertext via the real token endpoint.

Record the run date, sandbox used, and the `client_id` (NOT the secret) below
once executed.

### Execution log

| Date | Sandbox | client_id | Result | Operator |
| --- | --- | --- | --- | --- |
| _pending_ | _Cigna / Epic_ | | | |

---

## Status of this task

- **Part 1 (real Postgres + real migration):** ✅ executed and passing — all 8
  integration checks green, at-rest ciphertext confirmed directly in
  `payer_token_connections` (sample above), broker round-trip decrypts.
- **Part 2 (live sandbox OAuth exchange):** ⏳ operator-gated — blocked on
  sandbox `client_id`/`client_secret` (intentionally not in the repo) and the
  human browser-consent step. Runbook above is ready for a one-time manual run.
