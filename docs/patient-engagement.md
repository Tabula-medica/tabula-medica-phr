# Patient engagement — SMS

An engagement layer in the shape of 2care.ai's receptionist product, built to
US law rather than to their India-first WhatsApp model.

US only, gated on `TEFCA_ENABLED`. Not because engagement is a US idea — every
rule enforced here is US statute, and shipping TCPA quiet hours to a
jurisdiction they do not govern would look like compliance while enforcing the
wrong law.

---

## The two statutes, and why both gates exist

They do not overlap, and passing one says nothing about the other.

**HIPAA** permits appointment reminders and treatment communications without
separate authorisation. It does not make SMS a safe place to put clinical
detail — carrier networks, lock screens and shared family handsets are all
outside any agreement this deployment holds.

**TCPA** governs sending to a mobile number at all: prior express consent,
revocation honoured immediately by any reasonable means, and an 08:00–21:00
window in the **recipient's** local time. Statutory damages run $500–$1,500
per message with no de-minimis exception, so a reminder blast to an
unconsented list is a five-figure mistake before anyone notices.

A message can be perfectly fine under HIPAA and still be a TCPA violation.

---

## The send gate

Four independent checks, fixed order, all must pass. Order determines what an
operator learns: a revoked patient who also has no timezone hears "revoked",
because fixing the timezone would not make the send legal.

| # | Check | Refusal |
|---|---|---|
| 1 | Phone is E.164-able | `invalid-phone` |
| 2 | TCPA consent, and consent covers this purpose | `no-consent`, `consent-revoked`, `purpose-not-consented` |
| 3 | Template tier ≤ channel ceiling | `phi-tier-exceeds-channel` |
| 4 | Quiet hours, frequency cap | `frequency-cap`, `unknown-timezone`, deferral |

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
| Missing template variable | Refused — an unfilled `{{placeholder}}` is worse than no message |
| Missing language | English, and the response says `fellBackToEnglish` |

The unknown-timezone refusal is the one that looks over-strict and is not. The
practice's zone is wrong precisely for the patients most likely to be missing
one — the ones who moved. A clinic in New York sending at 07:30 Eastern reaches
04:30 in Los Angeles, and that is a violation per message.

---

## PHI tiers

| Tier | Contains | Allowed on SMS |
|---|---|---|
| `none` | Nothing patient-specific | yes |
| `appointment-logistics` | That a visit exists, when, where, with whom | yes |
| `clinical-detail` | A condition, medication, result, or instruction | **no** |

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

Eight hand-written translations (en, es, zh, vi, ko, ar, hi, ru) across all
templates, with the STOP notice localised to match the body.

Translations are hand-written, **not machine-produced at send time**. A
language without one falls back to English and the response says so. A
mistranslated appointment time is a missed appointment.

---

## Endpoints

```
GET  /api/engagement/policy           what this system will and will not send, and why
GET  /api/engagement/templates        catalogue with tiers and languages
GET  /api/engagement/journeys         cadences with the reasoning for each
POST /api/engagement/journeys/plan    expand a journey against an anchor
GET  /api/engagement/consent/:phone   consent state for one number
POST /api/engagement/consent          record or revoke
POST /api/engagement/inbound          process inbound SMS (STOP/START/HELP)
POST /api/engagement/preview          render without sending
POST /api/engagement/send             gate + dispatch (supports dryRun)
```

`/inbound` is unauthenticated by necessity — it is the carrier webhook, and a
STOP that fails because a signature check was misconfigured is a violation.
**Verify the Twilio signature at the edge in production.**

`dryRun` runs every check and returns what *would* have happened without
touching Twilio. Run a campaign through it first: it surfaces the
missing-consent and missing-timezone rows while they are still fixable.

---

## Configuration

```bash
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...
export TWILIO_PHONE_NUMBER=+1...
```

Twilio is BAA-eligible and already carries a third-party governance record in
this repo. Without credentials the gate still evaluates — sends refuse with
`channel-not-configured` rather than failing silently.

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
- **Voice is declared, not wired.** `CHANNEL_PHI_CEILING.voice` is set and the
  gate handles the channel; there is no telephony adapter.
- **No inbound booking agent.** 2care.ai's receptionist transacts against a
  calendar — checks availability, books, reschedules. That needs the EHR
  binding first; this layer is outbound plus inbound consent handling.
- **WhatsApp is deliberately absent.** Meta does not sign a BAA for the
  WhatsApp Business API. It could carry `none`-tier content in the US, or
  anything in the `.world` build under DPDP/GDPR, but it is not built here.
