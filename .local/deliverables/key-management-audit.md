# PHI Encryption Key Management — Audit

**Status:** AUDIT ONLY — no code changes. Findings produced from inspection
of the live codebase as of session 2b.5 close.
**Reviewer trigger:** Gap 1 (key management is the #1 risk in the F1 program;
losing the key = losing all patient data; no rotation procedure documented).
**Scope:** every secret that gates the AES-256-GCM PHI encryption path, plus
adjacent secrets that downstream services use to encrypt PHI-adjacent data.

---

## Inventory — secrets in use

| Secret env var | Required in prod? | Purpose | Loaded from | Used by |
|---|---|---|---|---|
| `PHI_ENCRYPTION_KEY` | **YES** (throws if absent) | Master input to scrypt KDF; derives the 32-byte AES-256-GCM key | GCP Secret Manager (preferred) → Replit Secrets fallback | `server/security/phi-encryption.ts::getEncryptionKey()` (the ONLY place an AES key is materialized for PHI) |
| `PHI_ENCRYPTION_SALT` (legacy) | conditional | scrypt salt; if length is 128 chars and starts with `PHI_ENCRYPTION_KEY`, it is split (compat with an early bug where salt was concatenated to key) | GCP Secret Manager → Replit Secrets | `phi-encryption.ts::getEffectiveSalt()` |
| `PHI_ENCRYPTION_SALT_V2` | preferred | Replacement scrypt salt (clean 64-char hex). Wins over legacy if present and ≠ key | Replit Secrets only (NOT in `MANAGED_SECRETS` list of GCP Secret Manager) | `phi-encryption.ts::getEffectiveSalt()` |
| `CARE_BRIDGE_SECRET` | unknown — only fingerprinted at startup, never read by `getEncryptionKey()` | Possibly intended for cross-tenant bridge encryption; currently dead code path? | Replit Secrets | Logged in `logPhiKeyFingerprints()`; no usage in `phi-encryption.ts` body |
| `SESSION_SECRET` | YES (separate concern) | (a) Express session cookie signing, (b) **fallback** input to `getEncryptionKey()` if `PHI_ENCRYPTION_KEY` is absent in dev, (c) HMAC for SmartHealthLink, (d) profile-photo encryption KDF, (e) messaging WS auth, (f) family-hub HMAC, (g) Auth0 cookie encryption, (h) mobile API HMAC | GCP Secret Manager → Replit Secrets | 8+ files (see grep audit below) |

**Grep evidence — `SESSION_SECRET` usage scope:**
```
server/services/smart-health-link-service.ts:13
server/services/profile-photo-service.ts:31
server/services/messaging-websocket-service.ts:49
server/services/auth0-identity-service.ts:82
server/family-hub-routes.ts:12
server/mobile-api-routes.ts:36
server/replit_integrations/auth/replitAuth.ts:41
server/security/phi-encryption.ts:50      ← PHI fallback path
```

**Grep evidence — `PHI_ENCRYPTION_KEY` usage scope:**
```
server/security/phi-encryption.ts:11,32,52,53,236   ← the only PHI consumer
server/security/index.ts:92                          ← presence check only
server/security/compliance-validator.ts:144,147,429  ← presence check only
server/services/gcp-secret-manager.ts:9              ← managed-secrets list
server/services/hipaa-compliance-service.ts:229,231  ← only a doc comment
```

PHI_ENCRYPTION_KEY consumption is centralized in **one** function:
`server/security/phi-encryption.ts::getEncryptionKey()`. Good — single point
of control.

---

## Loading flow at runtime

1. **`server/index.ts`** boots → calls `loadSecretsFromGCP()` from
   `server/services/gcp-secret-manager.ts`.
2. `gcp-secret-manager.ts::loadSecretsFromGCP()` iterates the
   `MANAGED_SECRETS` array and, IF the GCP client could be initialized
   (`GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   env var present), pulls each secret from GCP Secret Manager and writes
   it to `process.env`. Falls back to whatever was already in `process.env`
   from Replit Secrets if GCP fetch fails or is skipped.
3. `MANAGED_SECRETS` currently lists: `FASTEN_HEALTH_API_KEY`,
   `FASTEN_HEALTH_CLIENT_ID`, `FASTEN_HEALTH_REDIRECT_URL`,
   **`PHI_ENCRYPTION_KEY`**, **`PHI_ENCRYPTION_SALT`**,
   **`SESSION_SECRET`**, `ADMIN_PASSWORD`.
   ⚠ `PHI_ENCRYPTION_SALT_V2` is NOT in this list.
4. First call to `encryptPhi(plaintext)` → `getEncryptionKey()` →
   `scryptSync(secret, salt, 32)` → 32-byte buffer cached only within
   that call (no module-level cache; re-derived per call — see Finding 5).
5. AES-256-GCM cipher initialized with random 16-byte IV per encrypt.
   Output format: `<ivHex>:<authTagHex>:<ciphertextHex>`.

---

## Findings

### F-1 — No documented rotation procedure  🔴 CRITICAL
**Observation:** there is no script, runbook, or even comment describing
how to rotate `PHI_ENCRYPTION_KEY`. Rotation is non-trivial because every
existing ciphertext was encrypted under the current key and cannot be
decrypted with a new key — rotating in place would corrupt every PHI
column at rest.

**Required rotation procedure (must be authored before first real patient):**
1. Add new key as `PHI_ENCRYPTION_KEY_V2` env var.
2. Modify `getEncryptionKey()` to accept a key version, defaulting to V2 for
   new writes.
3. Modify `encryptPhi()` to prepend the key version to the ciphertext
   envelope: `v2:<ivHex>:<authTagHex>:<ciphertextHex>`. Today's format has
   no version byte — adding it now is the single biggest pre-rotation lift.
4. Modify `decryptPhi()` to inspect the version prefix and select the
   matching key (V1 for legacy untagged ciphertext, V2 for new).
5. Run a re-encryption backfill (similar shape to Action Item H) that
   reads every PHI cell, decrypts under V1, re-encrypts under V2.
6. Once 100% of rows are V2, retire V1 from `getEncryptionKey()`.

**Estimated work to make rotation possible: ~1.5 sessions** (versioned
envelope + decrypt dispatch + backfill script + tests). Current
infrastructure is rotation-incompatible.

### F-2 — `PHI_ENCRYPTION_SALT_V2` is not in the GCP-managed list  🟡
**Observation:** `MANAGED_SECRETS` in `gcp-secret-manager.ts` includes
`PHI_ENCRYPTION_SALT` (legacy) but NOT `PHI_ENCRYPTION_SALT_V2`. If
production switches to GCP Secret Manager as the source of truth,
`SALT_V2` won't be hydrated and `getEffectiveSalt()` will silently fall
back to legacy salt — wrong key derived → all writes corrupt.

**Fix:** add `"PHI_ENCRYPTION_SALT_V2"` to `MANAGED_SECRETS`. One-line
change. File now so future-prod-cutover doesn't bite us. (Out of audit
scope; recorded here for the next migration session.)

### F-3 — Dev fallback to `SESSION_SECRET` blurs the threat model  🟡
**Observation:** `getEncryptionKey()` line 50:
```ts
const secret = process.env.PHI_ENCRYPTION_KEY || process.env.SESSION_SECRET;
```
In production this is gated by the throw-on-missing check at line 52.
But in dev/staging, `SESSION_SECRET` becomes the PHI key. If a dev
environment ever had real PHI loaded (it shouldn't, see Action Item H
prerequisite), a dev's casual rotation of `SESSION_SECRET` would brick
all PHI in that database without any warning sign.

**Recommended:** drop the `SESSION_SECRET` fallback. Replace with an
explicit `dev-only-fixed-key-NOT-FOR-PRODUCTION` constant (already used
for the missing-secret case at line 63) so dev/prod paths share the same
shape: read PHI_ENCRYPTION_KEY or use a labeled dev constant.

### F-4 — Backup/recovery procedure: NOT DOCUMENTED  🔴 CRITICAL
**Observation:** if Replit Secrets are corrupted / cleared / the project
is migrated, and GCP Secret Manager is not the active source, the
PHI_ENCRYPTION_KEY is unrecoverable → all PHI ciphertext at rest becomes
permanently undecryptable. There is no:
- Documented escrow location for the key
- Sealed-envelope recovery procedure
- Cross-cloud backup of the secret value
- Founder-personal copy stored in a password manager

**Recommended (highest leverage, lowest cost):**
1. Write the active production `PHI_ENCRYPTION_KEY` into a 1Password / Bitwarden
   vault entry titled "Tabula Medica — PHI master key (DO NOT SHARE)".
2. Note in same entry: the salt (`SALT_V2`), the rotation date, and
   the GCP Secret Manager project ID where the canonical copy lives.
3. Authorize one trusted second human (cofounder, lawyer, spouse, etc.)
   to access that vault entry in case of founder unavailability.
4. Document the recovery procedure in this file under "Recovery runbook"
   below.

### F-5 — Re-derivation cost on every encrypt call  🟢 PERFORMANCE
**Observation:** `getEncryptionKey()` calls `scryptSync` on every encrypt.
scrypt is intentionally slow (memory-hard KDF). At write rates >100/sec
this becomes the bottleneck.

**Mitigation:** memoize the derived key inside the module after first
call (key inputs are env vars and don't change at runtime). Easy 1-line
fix. Do NOT cache across processes.

### F-6 — `CARE_BRIDGE_SECRET` is loaded but unused  🟡
**Observation:** present in `available_secrets`, fingerprinted at startup
in `logPhiKeyFingerprints()`, but no production code path consumes it.
Either (a) finish the bridge feature it was intended for, (b) remove it
from secrets to reduce attack surface, or (c) document its intended
future use here.

### F-7 — `getSecurityStatus()` reports `isProductionReady: true` based ONLY on `PHI_ENCRYPTION_KEY` presence  🟡
**Observation:** `phi-encryption.ts:236` — the readiness check ignores
salt presence, salt strength, and dev-fallback-active state. A prod
deploy missing `SALT_V2` would still report green.

**Fix:** also require `getEffectiveSalt()` to return ≥64-char value AND
require `secret !== "default-dev-key-change-in-production"` AND require
salt ≠ key (the WARNING at line 33 is logged but not surfaced in the
status object).

### F-8 — Dev/staging/prod separation: UNVERIFIED — pending user
**Observation:** the audit cannot determine from code alone whether dev,
staging, and prod environments use distinct `PHI_ENCRYPTION_KEY` values.
This is a pure configuration question.

**Required from user:**
1. Confirm the value in Replit Secrets (current dev) is DIFFERENT from
   the value that will be in GCP Secret Manager for prod.
2. If a staging environment exists, confirm it has its own distinct key.
3. Confirm no production key has ever been pasted into the Replit
   Secrets pane (which is shared across the dev workspace).

If any of these are violated, prod and dev share a key — a dev's local
log capture or a Replit support session could expose prod PHI.

### F-9 — `hashPhiForSearch()` uses the same scrypt-derived key as encryption  🟡
**Observation:** `phi-encryption.ts:150` — the hash function for
searchable columns (emailHash, mrnHash, phoneHash) uses the same
`getEncryptionKey()` output as the AES key. This means hash determinism
is tied to the encryption key — rotating the key would invalidate every
hash column too. Even with a versioned ciphertext envelope (F-1), the
hash columns have no version byte and would silently break lookup the
moment the key changes.

**Verification (session 2b.5 close, post-reviewer-query):** Reviewer
asked whether F-9 was already fixed in an earlier session. Verified
NOT FIXED. `grep -rn "PHI_HASH_KEY" server/` returns zero matches.
`phi-encryption.ts:150–154` still reads:
```ts
export function hashPhiForSearch(value: string): string {
  const key = getEncryptionKey();   // ← same key as encryption
  const hash = scryptSync(value.toLowerCase().trim(), key, 32);
  return hash.toString("hex");
}
```
And `phi-storage.ts::hashEmail/hashMrn/hashPhone` all delegate to
`hashPhiForSearch`, propagating the same coupling. The architectural
intent to separate the hash key may have been discussed in an earlier
session, but the code change did not ship.

**Fix during rotation work:** introduce a separate `PHI_HASH_KEY` env
var so hash determinism is decoupled from encryption-key rotation.
Bundled with Action Item L (see `f1-action-items.md`) — the L session
that introduces the key ring is the natural place to also wire the
hash key as an independent member of that ring.

---

## Recovery runbook (TO BE AUTHORED — placeholder)

This section will document, step-by-step:
1. Symptoms of a key-loss incident (decrypt errors in logs, every PHI
   read returning ciphertext blob, `[PHI-Encryption] Decryption failed`
   spam).
2. First-response actions (do NOT attempt re-encryption; do NOT run
   the H backfill; preserve the database in its current state).
3. Recovery options ranked by data-loss exposure:
   - Restore from password-manager escrow (F-4 above)
   - Restore from second-human's vault (F-4 above)
   - Restore PHI_ENCRYPTION_SALT only and accept that key was the
     missing input → still unrecoverable
   - Last resort: delete all encrypted PHI rows, notify affected
     patients per HIPAA Breach Notification Rule 164.404 (60-day
     window from discovery).

This runbook MUST be authored before first real patient signup.
Current status: not authored. Tracked under Action Item H prerequisites.

---

## Recommended sequencing (insert into `f1-action-items.md`)

These 6 items, in order, before Action Item H:

1. **F-4 escrow** — write key to vault, authorize second human. **30 min, user.**
2. **F-8 environment separation verification** — read off Replit Secrets pane and GCP Secret Manager values, compare. **15 min, user.**
3. **F-2 add `SALT_V2` to `MANAGED_SECRETS`** — one-line code edit. **5 min, agent.**
4. **F-7 strengthen `getSecurityStatus()`** — accurate readiness signal. **30 min, agent.**
5. **F-3 drop `SESSION_SECRET` fallback** — clean threat model. **30 min, agent.**
6. **F-1 versioned ciphertext envelope + rotation infra** — large lift. **~1.5 sessions, agent.**

F-5 (perf), F-6 (cleanup), F-9 (hash key separation) are non-blocking
quality work; can fold into F-1 session.

---

## Audit summary for the reviewer

| Area | Status |
|---|---|
| Single point of key consumption | ✅ Centralized in `getEncryptionKey()` |
| Algorithm | ✅ AES-256-GCM, random IV per encrypt, auth tag verified |
| KDF | ✅ scrypt (memory-hard); 🟡 derived per call (perf) |
| Key storage in code | ✅ No hardcoded keys; env-var only |
| Production guard | ✅ Throws if `PHI_ENCRYPTION_KEY` missing |
| GCP Secret Manager wired | ✅ Yes (`gcp-secret-manager.ts`); 🟡 missing `SALT_V2` |
| Rotation procedure | 🔴 NOT POSSIBLE without versioned envelope |
| Backup/recovery procedure | 🔴 NOT DOCUMENTED, no escrow |
| Dev/staging/prod separation | 🟡 UNVERIFIED — requires user check |
| Readiness check accuracy | 🟡 `isProductionReady` returns false-positive |
| Adjacent secret hygiene | 🟡 `CARE_BRIDGE_SECRET` loaded-but-unused |

**Bottom line:** the encryption is cryptographically sound, but the
**operational** controls around the key (rotation, recovery, escrow,
separation) are not auditor-ready. Two of the gaps (F-1, F-4) are
hard pre-TestFlight items because they protect against irrecoverable
data loss scenarios.
