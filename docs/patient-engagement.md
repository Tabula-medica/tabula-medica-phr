# Patient engagement — SMS and WhatsApp, India and US

An engagement layer in the shape of 2care.ai's product: reminders, pre-visit
prep, post-visit follow-up, care-plan check-ins, recall.

**Jurisdiction is a property of the patient, not of the build.** The rules
governing a message follow the person receiving it, so a `.world` deployment
serving Indian patients and a US deployment serving American ones run the same
code and reach different answers. An earlier cut gated the whole module on
`TEFCA_ENABLED`, which disabled it on the international build — shipping
nothing to the market that needs it most. That gate is gone.

---

## Two countries, four bodies of rules

| | United States | India |
|---|---|---|
| **Data** | HIPAA — minimum necessary | DPDP Act 2023 + DPDP Rules 2025 (notified Nov 2025) |
| **Channel** | TCPA — consent, revocation, 08:00–21:00 local | TRAI TCCCPR — DLT header + registered template; 09:00–21:00 promotional |
| **WhatsApp** | Meta Business Policy. **No BAA available** | Meta Business Policy. **Outside TRAI DLT** |
| **Notice** | No statutory language rule | English or one of the 22 Eighth Schedule languages |

Three corrections worth stating plainly, because each is commonly assumed the
other way:

**WhatsApp is not under TRAI DLT.** DLT attaches to telecom resources —
numbering, SMS routes, voice. WhatsApp Business API traffic is data-channel on
Meta's platform. Registering it is harmless; *assuming DLT covers it* is not,
because it leaves Meta's actual requirements unimplemented.

**Meta signs no BAA.** So in the US, WhatsApp carries a ceiling of `none` —
not even that an appointment exists. In India there is no BAA construct; the
DPDP duty runs to the Data Fiduciary directly, so appointment logistics are
permissible with consent. **The same template is sendable in Mumbai and
refused in Chicago.** That is correct behaviour, and a test pins it.

**In India the consent notice is constitutive, not paperwork.** DPDP s.5 makes
the notice part of what valid consent *is*. Consent with no recorded notice, or
a notice served in a language outside English and the Eighth Schedule, is
refused at send time.

A message can be perfectly fine under HIPAA and still be a TCPA violation, and
fine under both and still be dropped by an Indian operator for want of a DLT
template id. Each gate is checked separately.

---

## The send gate

Four independent checks, fixed order, all must pass. Order determines what an
operator learns: a revoked patient who also has no timezone hears "revoked",
because fixing the timezone would not make the send legal.

| # | Check | Refusal |
|---|---|---|
| 1 | Phone is E.164-able | `invalid-phone` |
| 2 | TCPA consent, and consent covers this purpose | `no-consent`, `consent-revoked`, `purpose-not-consented` |
| 3 | Registered template / service window | `dlt-registration-missing`, `whatsapp-template-not-approved`, `outside-service-window` |
| 4 | Template tier ≤ channel ceiling | `phi-tier-exceeds-channel` |
| 5 | Quiet hours (by purpose class), frequency cap | `frequency-cap`, `unknown-timezone`, deferral |

India adds a check before all of these: `consent-notice-missing` when consent
carries no recorded DPDP notice.

**Template registration and the service window interact, and the order
matters.** On WhatsApp an approved template may be sent at any time, and
free-form text is permitted *instead* while the 24-hour window the patient
opened is still open. Checking registration first makes free-form unreachable —
that was a real bug during the build, caught by a test. On India SMS, where
there is no window, DLT registration is unconditional.

Quiet hours produce **`deferred`**, not a refusal — the message is legitimate,
just early or late, and the caller gets the instant the window opens so it can
be queued rather than dropped.

### Refusals, never defaults

| Situation | Behaviour |
|---|---|
| No consent record | Refused. **Having a patient's number is not consent to text it.** |
| Any stop keyword | Revoked **globally across purposes**, permanently |
| Template above channel ceiling | Refused — not truncated, not redacted, not "sent with a warning" |
| Unknown timezone | Refused — **not** the practice's own timezone |
| India SMS, no DLT template id | Refused — operators *discard* unregistered traffic, so a "successful" send would never arrive |
| US WhatsApp, any patient-specific content | Refused — Meta signs no BAA |
| India consent with no recorded notice | Refused — DPDP s.5 |
| Missing template variable | Refused — an unfilled `{{placeholder}}` is worse than no message |
| Missing language | English, and the response says `fellBackToEnglish` |

The unknown-timezone refusal is the one that looks over-strict and is not. The
practice's zone is wrong precisely for the patients most likely to be missing
one — the ones who moved. A clinic in New York sending at 07:30 Eastern reaches
04:30 in Los Angeles, and that is a violation per message.

---

## PHI tiers, per channel per country

| Tier | Contains | US SMS | US WhatsApp | IN SMS | IN WhatsApp |
|---|---|---|---|---|---|
| `none` | Nothing patient-specific | ✓ | ✓ | ✓ | ✓ |
| `appointment-logistics` | That a visit exists, when, where, with whom | ✓ | ✗ | ✓ | ✓ |
| `clinical-detail` | A condition, medication, result, or instruction | ✗ | ✗ | ✗ | ✗ |

The one asymmetric cell is US WhatsApp, and it is the whole reason the tier
system exists rather than a boolean.

The tier is declared **per template**, next to the copy, rather than inferred
per message — inference is exactly what fails quietly when someone helpfully
interpolates a diagnosis into a follow-up body.

No template names a department that implies a diagnosis. "Your oncology
appointment" is a disclosure to whoever picks up the handset; "your appointment
with Dr. Chen" is not. Where the patient needs clinical content, the message
says something is ready and sends them to the authenticated portal.

**A structural guarantee, test-enforced:** no template in the catalogue is
classified `clinical-detail`, so clinical content cannot reach an SMS body even
if the gate were bypassed.

---

## Consent

Revocation is deliberately blunt:

- Any recognised stop keyword revokes, any casing, with or without punctuation
- **Global across purposes.** A patient who texts STOP to a recall message has
  not asked to keep receiving appointment reminders
- Permanent until a fresh affirmative opt-in — never inferred from later portal
  activity
- `START` restores only the baseline appointment purposes, not whatever the
  patient had before

The FCC requires honouring revocation by "any reasonable means", so free text
that reads as a stop request (`"please stop texting me"`, `"take me off this
list"`) **revokes and flags for staff review** — erring toward not-texting
costs a reminder; erring the other way is the violation. Matching is
conservative on both sides: "I'll stop by the front desk at 3" is not a
revocation, and a test pins that.

A real patient reply is never auto-answered. It routes to a human.

---

## Journeys

Declarative offsets from an anchor, so a practice can read the whole cadence
on one screen instead of inferring it from six cron entries.

| Journey | Cadence | Why |
|---|---|---|
| Appointment reminders | −7d, −1d | Most of the no-show benefit is in the first two touches; a third buys opt-outs |
| Pre-visit preparation | −48h | Late enough to be remembered, early enough to act on |
| Post-visit follow-up | +24h | While the visit is fresh |
| Care plan check-ins | +7d, +30d | The window where adherence is decided |
| Recall / reactivation | +365d | One touch, no follow-up — this is where messaging tips into marketing |

Touches already past are **dropped, not fired late**. A reminder for a visit
starting in 20 minutes, delivered because a job backed up, is worse than silence.

---

## Languages

**Two lists, deliberately kept apart.** `GET /api/engagement/languages`
returns both:

- **The Eighth Schedule** — the 22 constitutional languages a DPDP consent
  notice may lawfully be served in, plus English. Fixed by statute, not by
  what happens to be translated here. Includes Santali (`sat`) and Bodo
  (`brx`), which have no ISO 639-1 two-letter code, and four RTL scripts.
- **What is actually translated** — 18 languages: en, es, zh, vi, ko, ar, ru,
  plus hi, bn, ta, te, mr, gu, kn, ml, pa, or, as, ur.

Conflating them is the failure this guards against. A dropdown offering 22
choices that silently serves English for fourteen of them has produced a
dropdown, not a notice. Every render reports `languageUsed` and
`fellBackToEnglish`.

Translations are hand-written, **not machine-produced at send time** — a
mistranslated appointment time is a missed appointment, and machine
translation turns one bad string into a systematic one.

---

## Endpoints

```
GET  /api/engagement/policy           per-jurisdiction rules + the instrument behind each
GET  /api/engagement/languages        Eighth Schedule vs what is actually translated
GET  /api/engagement/templates        catalogue with tiers, languages, registration state
GET  /api/engagement/journeys         cadences with the reasoning for each
POST /api/engagement/journeys/plan    expand a journey against an anchor
GET  /api/engagement/consent/:phone   consent state for one number
POST /api/engagement/consent          record or revoke
POST /api/engagement/inbound          process inbound SMS (STOP/START/HELP)
POST /api/engagement/preview          render without sending
POST /api/engagement/send             gate + dispatch over `sms` or `whatsapp`
```

`/policy` takes `?jurisdiction=US|IN`, and returns the legal instrument behind
every rule — published rather than buried so a practice can audit the policy
without reading the code.

`/inbound` is unauthenticated by necessity — it is the carrier webhook, and a
STOP that fails because a signature check was misconfigured is a violation.
**Verify the Twilio signature at the edge in production.**

`dryRun` runs every check and returns what *would* have happened without
touching Twilio. Run a campaign through it first: it surfaces the
missing-consent and missing-timezone rows while they are still fixable.

---

## Clinic-initiated sharing is refused, and why

`POST /api/engagement/share` with `initiator: "clinic"` returns **501**. That
is deliberate and it closes a real hole rather than deferring a feature.

The path took a caller-supplied `profileId` and minted a **bearer link** to
that person's medications, diagnoses and allergies — redeemable with no
authentication at all — behind nothing but a clinic-staff role check. A role
check answers *"does this caller work here"*. It cannot answer *"does this
caller have any business with this patient"*, and only the second question
bounds that disclosure.

The reasoning that put it there was carried across from a place it was true:
on engagement `/send` I argued that staff legitimately message patients other
than themselves, so the role is the right boundary rather than ownership. That
holds for texting a number the practice already has. It does not hold for
opening an arbitrary profile UUID's chart to whoever holds a URL.

The check it needs is a treatment relationship, and this codebase cannot
answer it. `storage.isProviderAuthorizedForPatient` exists but is a
process-local `Map` — on ten Cloud Run instances it returns false on nine,
which denies legitimate access rather than granting illegitimate access. That
is a different bug, not a control. There is no durable provider-patient table.

So: refuse. `GET /api/engagement/share/list` ignores `?profileId=` and always
uses the caller's own profile, and `POST /s/:id/revoke` accepts only the
caller's own grants — both had the same staff bypass built on the same missing
check. The patient-initiated path, which is what the feature is built around,
is unaffected.

The 45 CFR 164.524(c)(3)(ii) signed-directive rule still lives in
`SHARE_POLICIES` and is still reported by `/api/engagement/share/policy`.
Whoever restores the clinic path restores that check with it — and must not
collapse it into the recipient's consent to be messaged, which is a different
permission from a different person.

## One staff guard, not one per route

`requireClinicStaff` in `server/lib/middleware/require-clinic-staff.ts` is now
the single definition, applied to the HCC, RVU, provider-directory and
referral routes as well as engagement.

Those routes were on `isAuthenticated`, which admits any signed-in patient
account — the same defect fixed on engagement `/send` and `/consent` two
rounds earlier. It recurred because that fix was applied to the routes that
were reported rather than to the class of route they belong to. Sharing the
wrapper is what stops the next clinician tool from being written with the
wrong question.

The middleware's own docstring says what it is not: a role is not a treatment
relationship. It is the right boundary for a route that takes clinical content
in the request body, and it is *not* sufficient for a route that loads a
patient by id.

## Storage, and why it is not a Map

Share grants and consent both live in Postgres (`health_summary_shares`,
`engagement_consents`). They used to be process-local `Map`s carrying comments
saying a production deployment would persist them.

That framing was wrong, not merely incomplete. **Every deploy path in this repo
already runs ten instances**: `deploy.sh`, `deploy-world.sh`,
`deploy/gcp-deploy.sh` and `cloudbuild.yaml` all pass `--max-instances=10` to
Cloud Run with no session affinity. So the comments were describing a live
defect as a future one.

What was actually broken:

| | Consequence |
|---|---|
| **Consent** | A patient texts STOP. The webhook lands on instance 3. The other nine have never heard of it and keep passing the send gate — a statutory opt-out honoured on a tenth of the traffic |
| **Share revoke** | Staff revoke on instance A; instances B–J keep serving medications, diagnoses and allergies to whoever holds the link. `/s/:token` needs no authentication |
| **View cap** | Per-process, so ten instances gave ten times the views |
| **PIN lockout** | Same — the 5-attempt cap added a round earlier was really 50 |
| **Restart** | Every outstanding link died on deploy |

Every counter that bounds disclosure is now claimed in a **single conditional
UPDATE** rather than a read, a decision and a write. With ten instances serving
the same link, read-modify-write is a race that hands out extra views.

Phone numbers are stored encrypted and looked up by HMAC (`hashPhone`), so the
consent check still runs without decrypting anything. The earlier claim that a
phone number plus a consent flag was "contact-preference metadata" outside the
PHI path was wrong: a number a covered entity holds because that person is a
patient is individually identifiable health information, and a table of them is
a patient list.

> **What the tests do not cover.** The suite has no database, so storage runs
> against an in-memory double that is faithful to the contract and *cannot*
> exercise the concurrency guarantee — under a single-threaded double, an
> atomic UPDATE and a read-modify-write are indistinguishable. The rules are
> tested; the races are not. That needs an integration test against a real
> Postgres, which this repo has no harness for. Stated here rather than left to
> be inferred from a green suite.

> **Still per-instance: the weekly frequency cap.** `recordSend` keeps its
> count in process, so the 5-messages-per-week cap is really up to 5 per
> instance. Unlike consent this is not a legal control — neither TCPA nor
> TCCCPR sets a frequency limit, and the cap is a judgement about when a
> reminder system becomes the thing people mute. It still wants the same
> treatment; the gate already takes the count as an input so a durable counter
> drops in without touching the rules.

## Configuration

```bash
# SMS (both countries)
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...
export TWILIO_PHONE_NUMBER=+1...

# India SMS — TRAI DLT template ids, internalId=dltId
export DLT_TEMPLATE_IDS="appointment-reminder=1107xxxxxxxxxxxxx,..."

# Template links — https origins that may appear in a message
export PATIENT_PORTAL_ORIGINS="https://portal.clinic.example"

# WhatsApp — Meta approved template names, internalId=approved_name
export WHATSAPP_PHONE_NUMBER_ID=...
export WHATSAPP_ACCESS_TOKEN=...
export WHATSAPP_APPROVED_TEMPLATES="appointment-reminder=appt_reminder_v1,..."
```

Twilio is BAA-eligible and already carries a third-party governance record in
this repo. Empty registration maps are the correct state before a deployment
has been through DLT registration or Meta review — the gate refuses, rather
than letting the failure surface at the operator's drop counter or at Meta,
where the practice never sees it.

---

## Limitations, stated rather than buried

- **Consent and send history are in-memory.** The interfaces are right; a
  production deployment persists them. Consent deliberately is not a PHI table
  — a number plus a flag is contact metadata, and keeping it out of the
  encrypted path lets the consent check run before any PHI is loaded.
- **No scheduler.** `planJourney` computes when touches are due; nothing fires
  them yet. Wire it to the existing `sync-scheduler` or a job runner.
- **No EHR binding.** Appointment times come from the caller. Reading them from
  a live schedule needs the FHIR/SMART path in `server/fhir/`.
- **No WhatsApp transport.** Every WhatsApp gate is implemented and tested,
  but there is no BSP client, so `dispatchWhatsApp` returns `would-send`
  rather than `sent`. Named honestly so nobody believes a message went out.
- **Voice is declared, not wired.** The ceiling is set per jurisdiction and the
  gate handles the channel; there is no telephony adapter.
- **No inbound booking agent.** 2care.ai's receptionist transacts against a
  calendar — checks availability, books, reschedules. That needs the EHR
  binding first; this layer is outbound plus inbound consent handling.
- **Only 10 of 22 Eighth Schedule languages have template copy.** The notice
  requirement is met for any of them by supplying a notice; the *templates*
  cover the ten largest. The endpoint reports exactly which, rather than
  implying full coverage.
- **The DPDP Consent Manager framework is not implemented.** It becomes
  operative 13 November 2026, with full compliance by 13 May 2027. Consent is
  recorded locally with its notice; registering with a Consent Manager is a
  separate piece of work.
- **Only US and India.** GDPR/EU is not modelled. Adding a jurisdiction is one
  entry in `jurisdictions.ts`, which is why that table exists.

---

# Sharing a medication, diagnosis and allergy list

The three lists someone actually needs when a patient turns up somewhere new.
They are also the three *required* sections of the International Patient
Summary, so the share reuses the data `ips-generator.ts` already collects
rather than inventing a second shape for the same facts.

## The message carries a link, never the list

Medications, diagnoses and allergies are classified `clinical-detail` — the
top PHI tier. Every messaging channel in both jurisdictions sits below that
ceiling, so the send gate refuses to put any of it in a message body. That is
the correct behaviour and it was not relaxed for this feature.

An SMS is stored in plaintext on the handset, in the carrier's logs, and in
whatever backup the handset syncs to; it renders on a lock screen to whoever
is holding the phone. A medication list is a diagnosis list by inference —
metformin says diabetes, and a short list of antiretrovirals says something a
patient may not have told their family.

So the notification is `appointment-logistics`: it says a clinic has a summary
for you and gives a link. That is the same disclosure an appointment reminder
already makes. The clinical content renders over TLS on a page that is
`noindex`, `no-store`, and `Referrer-Policy: no-referrer` — the last because
the token is in the URL path, and any external resource on that page would
leak it in a `Referer` header.

## Three flows, three different laws

| Flow | Sender | What governs it |
|---|---|---|
| **Clinic → its own patient** | the practice | Full gate: consent, quiet hours, cap, channel ceiling |
| **Patient → anyone, from their own handset** | the patient | Nothing — the practice is not the sender |
| **Clinic → a third party at the patient's request** | the practice | Full gate run against the **third party's** number |

Flow 2 is the default for "text my med list to my daughter", and it is not a
workaround. The server mints the link and returns a pre-filled `sms:` or
`wa.me` intent; the patient's own device sends it, from the patient's own
number, to a contact the patient picked. Neither the HIPAA disclosure rules
nor TCPA's consent requirement attaches to the practice for that send.

Flow 3 is the one people reach for and should not. Under TCPA the consent that
matters belongs to the **recipient**, and a patient cannot give it on their
daughter's behalf — the FCC reads "called party" as the current subscriber or
customary user, not the intended recipient. `mintShare` refuses
`initiator: "patient"` combined with a `server-*` delivery for exactly this
reason. If a practice genuinely must send directly, the third party needs
their own prior express consent captured first, and that is a **separate
record** from the patient's written direction. The operator UI must not let
the two collapse into one form.

## The US and India disagree about what this feature is

| | United States | India |
|---|---|---|
| Transmission at the patient's direction | **A duty** | **Discretionary** |
| Basis | 45 CFR 164.524(c)(2)(i)-(ii); OCR right of access guidance | DPDP Act 2023 s.4, s.6 — a new purpose needing fresh consent |
| Third party | (c)(3)(ii): written, signed, names the person and destination | No equivalent |
| Portability right | Yes, via right of access | **None** — dropped from the 2019 Bill; ss.11-14 give no transmission duty |

Two things worth stating for whoever reads the code next:

**45 CFR 164.524 never mentions email, SMS, or encryption.** The duty to
transmit by an unsecured channel is built from the general form-and-format
rule plus OCR's reading of "readily producible", together with the guidance
that a covered entity is not responsible for interception in transit once the
individual has been warned and accepted the risk. Someone who greps the
regulation for "unencrypted", finds nothing, and concludes the duty is
imaginary has not found a gap.

**The third-party directive is narrower than it reads.** *Ciox Health, LLC v.
Azar*, 435 F. Supp. 3d 30 (D.D.C. 2020) vacated it insofar as it reached
beyond electronic PHI held in an EHR and requested in electronic form, and
held the (c)(4) fee cap inapplicable to third-party transmittals. An
electronic medication, problem and allergy list is inside what survives.

`GET /api/engagement/share/policy` returns this table with the instrument
behind each row, the same way `/policy` does for messaging.

> **Verify before relying on this in a filing.** These citations were compiled
> from secondary sources; the section numbers and the case are solid, the
> paraphrases are not quotations. The Indian position in particular has a live
> commencement question — most operative DPDP Rules 2025 provisions phase in
> at 13 May 2027, and which *Act* sections are in force before then was not
> established. Put an India launch to local counsel.

## The empty allergy list

The single most safety-critical behaviour in the module.

An empty allergy section reads to every human being as "no allergies", and a
reader acting on that can kill someone with a drug that was known to cause
anaphylaxis but was never typed in. An empty table means nobody recorded
anything; it does not mean anybody asked.

So an empty section renders one of two ways, in words, in the reader's own
language:

- **`not-recorded`** — "No allergies recorded. This does not mean there are
  none — nothing has been entered." Plus a warning banner at the top of the
  page, because a reader who never scrolls to the allergy section is exactly
  the reader it protects.
- **`attested-none`** — "No known allergies. Confirmed by the patient." Only
  when somebody affirmatively said so.

There is no attestation column on `phr_allergies` today, so the attestation
arrives with the mint request. Until a patient or clinician actually asserts
it, every empty allergy list is `not-recorded`, which is the honest reading.

A related note on the IPS generator: `buildIpsBundle` currently emits
`no-known-allergies` for an empty list. By its own documentation that code
means "we asked, and the answer was none", which the data does not support.
That is not changed here — it would alter signed passport output — but it is
the same defect this module refuses to repeat, and it should be revisited.

**Inactive entries are shown, not dropped.** A stopped medication is
clinically live information: warfarin discontinued last week still governs
what is safe to give today. Filtering to `active` would produce a shorter,
cleaner, more dangerous list. Non-active rows sort after the active ones and
carry their status.

**Allergies render first** regardless of the order the caller asked for. Every
clinical handover format leads with allergies, because an allergy is the thing
that stops a prescription and a reader who scrolls past it has already made
the decision it was meant to inform.

## The link

| Property | Default | Cap |
|---|---|---|
| Lifetime | 24 h | 7 days |
| Views | 10 | 50 |
| Token | 256 bits, base64url | — |
| PIN | off | 6 digits |
| Wrong PINs before the link closes | — | 5 |

- The token is stored as a SHA-256 hash. It is returned exactly once.
- **Two counters, deliberately.** A wrong PIN does not burn a *view* — or
  guessing would be a way to exhaust somebody else's link. But it cannot be
  free either: a 6-digit PIN is a million-wide space, which is nothing to a
  machine and everything to a person typing it once, so failures increment a
  separate attempt counter and the grant **locks at 5**. A correct PIN clears
  the count. The cost is that whoever holds a link can lock it by guessing
  badly; that is the right side to fail on, because a locked link is recovered
  by minting another and a disclosed medication and allergy list is not
  recovered at all.
- A locked grant keeps saying **locked** for the rest of its life rather than
  changing its story to "expired" — "expired" invites asking for the same link
  again.
- PINs are hashed with **scrypt off the main thread** and compared in constant
  time. `scryptSync` blocks for tens of milliseconds by design; on an
  unauthenticated route taking an attacker-supplied PIN, that hands anyone a
  way to stall the process serving clinical routes.
- **The PIN never travels in a query string.** A GET on a PIN-gated link
  renders a form; the form POSTs. `?pin=` is ignored rather than honoured, so
  a link built the old way fails closed to the form. Access logs, proxy logs
  and browser history all record the request line, and a PIN sitting in any of
  them protects nothing.
- `/s/:token` and the JSON twin carry a **dedicated 30 req/min limiter**. The
  global `apiRateLimiter` skips every path that does not start with `/api`, so
  the HTML route would otherwise have no application rate limit at all.
- A revoked link reports `token-revoked`, not `token-not-found`. The person
  holding it otherwise cannot tell a revocation from a typo and will keep
  retrying something that will never work again.
- An over-long lifetime is **refused, not clamped**, so the caller knows what
  it got.
- `HEALTH_SHARE_BASE_URL` must be an https origin. It is never derived from
  the request `Host` header: that is attacker-controlled, and a link built
  from it would be a phishing target sent under the clinic's own name.

## Endpoints

```
GET  /api/engagement/share/policy       per-jurisdiction rules + the instrument behind each
POST /api/engagement/share              mint a link — patient-initiated only  [auth]
GET  /api/engagement/share/list         live and dead links for a profile    [auth]
POST /api/engagement/share/:id/revoke   kill a link                          [auth]
POST /api/engagement/share/view         the summary as JSON, token in body   [token]
GET  /s/:token                          inert interstitial — no PHI, no redeem
POST /s/:token                          redeem and render the summary        [token]
```

`/s/:token` is unauthenticated by design — the recipient is a pharmacist or a
relative, not an account holder. The token is the credential, which is why it
is 256 bits, short-lived, view-capped and revocable. The page is
self-contained: inline CSS, no scripts, no external resources, `default-src
'none'`.

### Reachability: the SPA catch-all has to be told about `/s/`

`serveStatic` mounts **before** the API routes in production and its
`app.use("*")` answers everything it does not recognise with the SPA's
`index.html`. `isServerRoutePath` in `server/static.ts` is therefore not a
convenience list — it is the reachability contract for every server-rendered
route outside `/api`.

`/s/` was missing from it, and the effect was worse than a 404. The share link
served the marketing SPA, which is `robots: index, follow` and loads a Google
Fonts stylesheet. So the 256-bit bearer token sat in the URL of an indexable
document with a cross-origin subresource, meaning it went out in a `Referer` —
while the page's own CSP, `Referrer-Policy: no-referrer`, `noindex` and
inert-GET interstitial, all written specifically to prevent that, never
executed. `POST /api/engagement/share/view` stayed reachable under `/api`, so a
token recovered that way still redeemed a summary.

Adding a server-rendered route outside `/api` means adding it here too.
`tests/static-route-reachability.spec.ts` pins it, including that `/s` must not
match by bare prefix — otherwise `/settings` and `/summary` would be swallowed
by the server instead of reaching the SPA.

### A GET renders nothing, and that is the point

WhatsApp, iMessage, Slack and mail scanners **fetch a shared link** to build a
preview. The first GET is the platform's crawler, not the recipient.

That runs straight through this feature's central claim. The list travels as a
link rather than in the message body because Meta signs no BAA — and then
handing Meta the link means Meta fetches it. Rendering the summary on GET would
have delivered the medication and allergy list to the platform anyway, burned a
view before the human opened it, and put the patient's name into a cached
preview snippet via the page title. The `handoff-whatsapp` intent handed the
link to the exact platform the architecture existed to keep it away from.

So **a GET is inert**. It returns a generic interstitial with a button, holds no
patient name and no clinical content, and does not touch the share registry at
all — an unfurler cannot even learn whether the token is real. **Redemption
happens on POST**, which crawlers do not issue and preview generators do not
click. Every page carries the same generic `<title>`, since a title is what an
unfurl displays and what a browser writes into history.

The JSON twin is `POST /api/engagement/share/view` with the token **in the
body**. `server/index.ts` logs `{ method, path, status }` to stdout for every
`/api` request, so a token in the path would be written to the application log
— and for a default grant with no PIN that token is the only secret. Anyone
able to read stdout or the log aggregator could otherwise replay outstanding
links, a strictly wider audience than the HIPAA audit table this module writes
to deliberately.

Page rendering lives in `summary-page.ts` rather than inline in the route, so
what a preview fetch is allowed to see is unit-tested rather than asserted in a
comment.

> **Deployment caveat this does not fix.** Moving the token off the `/api` path
> keeps it out of *this process's* logs. A reverse proxy, load balancer or CDN
> in front of the app will still record the `/s/<token>` request line, and for a
> grant with no PIN that token is the only secret. Whoever operates the edge
> has to suppress or redact the path for `/s/*`, or accept that anyone who can
> read those logs can replay an outstanding link until it expires, hits its view
> cap, or is revoked. This cannot be closed in application code.

## Configuration

```bash
HEALTH_SHARE_BASE_URL=https://records.example.org   # required; https only
PRACTICE_DISPLAY_NAME="Ltfm Health"                 # appears in the notification
```

## Not built

- ~~**Share grants live in memory.**~~ **Fixed.** They are in Postgres, and so
  is consent — see below.
- No attestation column on `phr_allergies`, so "no known allergies" cannot yet
  be recorded durably against the record — only against a share.
- No caregiver or proxy access path; the mint is the account holder's own
  profile or a staff action.
- Only the 19 languages with a full string set are translated. `GET
  /api/engagement/languages` reports that list against the 22 Eighth Schedule
  languages a DPDP notice may lawfully be served in.
- No PDF. The page is the artefact.
