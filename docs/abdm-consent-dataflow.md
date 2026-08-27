# ABDM consent and health-information data flow (India)

Operator guide for the layer built on top of the ABDM foundation merged in #68 (gateway session,
RSA field crypto, India-proxied fetch, ABHA enrollment).

#68 got the PHR as far as *creating an ABHA number*. It could not fetch a single record. This
layer is the part that pulls records: consent, and the encrypted data flow the consent unlocks.

**Sandbox only.** Nothing here is cleared for production use against real patient data, and a
production ABDM deployment additionally needs the PHR's own ABDM registration and a data
protection agreement. It is off by default and does nothing until `ABDM_ENABLED=true`.

---

## The flow

```
patient  →  PHR      POST /api/abdm/consent/request        raise a consent request
patient  →  ABHA app                                       grants (or refuses) in their PHR app
gateway  →  PHR                                            consent artefact id
PHR      →  gateway  GET  /api/abdm/consent/:consentId     fetch artefact, evaluate it
PHR      →  gateway  POST /api/abdm/hi/request             request data + publish key material
HIP      →  PHR      POST /api/abdm/hi/transfer            encrypted pages, decrypted on arrival
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ABDM_ENABLED` | `false` | Master switch. Off ⇒ stubs, and the transfer route does not exist. |
| `ABDM_HIU_ID` | *(empty)* | The id ABDM issued this PHR as a Health Information User. |
| `ABDM_HIU_NAME` | `Tabula Medica PHR` | Requester name shown to the patient when they are asked to consent. |
| `ABDM_DATA_PUSH_URL` | *(empty)* | Public HTTPS URL of this deployment's `/api/abdm/hi/transfer`. Must match what is registered with ABDM. |
| `ABDM_TRANSFER_BODY_LIMIT` | `2mb` | Body cap on the push endpoint. |

Plus everything #68 already documents (`ABDM_BASE_URL`, `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`,
`ABDM_CM_ID`, `ABDM_HTTPS_PROXY`).

An unset or wrong `ABDM_HIU_ID` does **not** widen access. Consent artefacts name the HIU they
were granted to, and an artefact naming a different HIU is refused — so the failure mode of a
misconfiguration is a stopped data flow, not a silent one.

---

## Where the ABHA address comes from, and why it matters

`evaluateConsentArtefact` refuses an artefact whose `patient.id` is not the requesting user's ABHA
address. **That check is worth nothing if the address comes from the request body** — it would
compare an attacker-supplied value against itself and always pass.

So the address is resolved server-side, from `external_identities` (provider `abdm-abha`), and no
consent or data-flow route accepts one from the client. The link is written only on a **verified**
ABHA enrollment; the stub path returns an unverified demo profile, and linking that would let any
account claim the demo address and any consent artefact issued for it.

The table's unique `(provider, external_sub)` index means one ABHA address belongs to one user.
A second user claiming an already-linked address is refused, not silently re-pointed — the same
first-claim-wins posture `server/auth/fasten.ts` takes for Fasten BYOI.

## What the consent gate checks

`evaluateConsentArtefact` is pure — no clock, no network, no config — so the decision is
reproducible from the artefact alone and every branch is testable. Any refusal makes the whole
evaluation unauthorised; refusals are never downgraded to warnings.

| Refusal | Fires when |
|---|---|
| `consent-not-granted` | Status is not `GRANTED` — including *absent*, which is not assumed to mean granted |
| `patient-mismatch` | The artefact was granted for a different ABHA address |
| `hiu-mismatch` | The artefact was granted to a different HIU, or ours is unconfigured |
| `purpose-not-permitted` | Purpose is not `PATRQT` |
| `hi-type-not-consented` | Any requested HI type is absent from the artefact |
| `consent-erase-deadline-passed` | `permission.dataEraseAt` is in the past |
| `date-range-not-covered` | The requested window is not inside `permission.dateRange` |
| `malformed-artefact` | A required field is missing or unparseable |

Three of these are worth their reasoning:

**Purpose is restricted to `PATRQT`.** `CAREMGT` belongs to a treating provider and `BTG` is an
emergency break-the-glass override. Neither is a purpose a personal health record can honestly
assert on the patient's behalf.

**An unconsented HI type refuses the whole request** rather than fetching the covered subset. A
partial result nobody asked for is indistinguishable from "the patient has no records of that
type" — the same failure the IPS work names for an empty allergy section.

**A too-wide date range refuses instead of silently narrowing.** Quietly clamping returns fewer
records than asked for, which reads to a patient as "you have nothing from before that date".
The refusal names the consented window so the caller can re-ask precisely, and
`clampToConsentWindow` exists for a caller that wants the intersection — as a deliberate act.

## What is *not* verified

**The consent artefact signature.** ABDM signs artefacts; this deployment pins no Consent Manager
key and the exact detached-signature encoding is not settled here. Rather than ship a verifier
that might pass everything — worse than none — evaluation always reports `issuerVerified: false`
with a caveat saying the artefact is trusted because it arrived over an authenticated session
with the gateway, **not** because its signature was checked. A caller needing cryptographic
issuer proof does not have it, and can see that it does not.

**The per-entry `checksum`.** AES-GCM already authenticates every entry under a key only the two
parties hold, which is strictly stronger than an unkeyed digest travelling beside the data it
describes.

---

## Data-flow cryptography

Per transfer, both sides generate an ephemeral X25519 keypair and a 32-byte nonce:

```
sharedSecret = X25519(ourPrivate, theirPublic)
xor          = ourNonce XOR theirNonce          (XOR is commutative — both sides agree)
salt         = xor[0..20)      iv = xor[20..32)
aesKey       = HKDF-SHA256(sharedSecret, salt, info, 32)
payload      = AES-256-GCM(aesKey, iv), 16-byte tag APPENDED
```

Keys are ephemeral per request: one recovered private key must not decrypt every past transfer.

**Unverified against a live HIP: the HKDF `info` parameter.** ABDM reference implementations
derive with an empty `info`, which is the default and is centralized in `HKDF_INFO`. If a real
sandbox transfer fails with an auth-tag error and key material was exchanged correctly, check
this first. The failure mode is loud: a wrong key makes GCM fail authentication — it cannot
silently produce wrong plaintext.

Refusals rather than guesses: a nonce that is not exactly 32 bytes is refused rather than padded
(it is remote-controlled input, and a short nonce silently changes the derived key); a peer key
on the wrong curve is refused as curve confusion, not a formatting quirk; an all-zero shared
secret is refused as a key the peer chose.

## The push endpoint

`POST /api/abdm/hi/transfer` is unauthenticated *by protocol* — HIPs push with no credential of
ours. Three things make that safe:

1. **It is mounted only when ABDM is enabled.** In the default configuration, which is every
   current deployment, the path does not exist and adds no attack surface.
2. **A payload is only decrypted against a pending exchange this process created.** No match, no
   private key, nothing to decrypt with — an unsolicited payload cannot enter the record.
3. **Its own 2mb body limit**, mounted in `server/index.ts` ahead of the global 10mb JSON parser
   (body-parser skips an already-parsed body, so the stricter cap only applies if it runs first).
   That placement also puts it ahead of CSRF, which a machine-to-machine caller could never
   satisfy. It stays behind the global rate limiter.

The endpoint acknowledges with counts only. Decrypted entries are PHI and are never echoed back
to the pusher, which has no claim to see what was successfully read.

### Pending exchanges are in-memory and process-local

Deliberate and bounded, not an oversight:

- **It fails closed.** A transfer arriving at an instance that does not hold the matching exchange
  is refused, never accepted-and-trusted. On a restart or a second instance the symptom is a
  rejected transfer — visible and safe — rather than silent acceptance of an unverified payload.
- **It must be replaced by shared durable storage before ABDM runs multi-instance in production.**
  Until then, single-instance is a deployment *requirement*, not an assumption.

---

## The erase obligation

`permission.dataEraseAt` is the date the patient agreed their data would be deleted by. It is
required on a consent request — there is no default, because picking one on the patient's behalf
is choosing how long their records are retained without asking. It is surfaced as `eraseAtMs` on
the request acknowledgement and on every accepted transfer.

**Enforcing it is not built here.** This layer reports the deadline; scheduled deletion of
records fetched under a consent is the next piece of work, and until it exists the obligation is
tracked by whoever operates the deployment.

## Known limitations

- Consent artefact signatures are not verified (above).
- Pending exchanges do not survive a restart (above).
- Automated erasure at `dataEraseAt` is not implemented (above).
- The v3 endpoint paths are centralized in `ENDPOINTS` in `consent.ts` and `data-flow.ts` and
  should be confirmed against the live HIECM sandbox, following the convention `abha.ts` set.
- Consent *revocation* notifications from the gateway are not handled; a revoked artefact is
  caught on the next evaluation, but an in-flight transfer is not interrupted.
- In stub mode there is no artefact to fetch, so `/api/abdm/hi/request` refuses with
  `malformed-artefact`. The data path is exercised by the test suite, not by the stub routes.
