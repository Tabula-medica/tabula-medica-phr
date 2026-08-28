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
