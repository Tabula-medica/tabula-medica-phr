# Pricing — low-income tier

**Date:** 24 October 2026
**Status:** Affordability price, revised after the reviews in `docs/reviews/`. Re-check Google Cloud, Stripe, and the Fasten contract before charging anyone. Figures marked **assumption** or **verify** are not a quote. This page is not legal advice.

The tier exists so a person on Medicaid, Medicare (fee-for-service or Medicare Advantage), or both can keep the same record as everyone else. Do not build a thinner chart for the cheaper price.

## Price

**$10 per member per year** is the price a beneficiary pays.

That is **$0.83 a month** before card fees and about **$0.78 a month** after one US card charge at 2.9% + $0.30 ($10 × 0.029 + $0.30 = $0.59 for the year). A $1 monthly card charge is not offered. At that rate the fee alone is about $0.33, which is a third of the dollar, and it costs more than a year of Google Cloud for one member of a shared database.

A plan or clinic that is not a drug or device manufacturer may pay the $10 by ACH invoice. The member then pays $0. The invoice is not a card micropayment. Manufacturer and device-company sponsorship is not accepted. See the consolidation plan for the Anti-Kickback and beneficiary-inducement limits.

App stores take a fee. The $10 price is on the web. Members who cannot pay by card are not turned away: attestation plus a sponsor invoice, or a no-charge hardship continuation, covers them. Failing a renewal check does not delete the record and does not silently start a paid plan. Any later paid plan needs a separate consent, notice, and a grace period.

## What the $10 includes

The same record as the household plan: conditions, medications, allergies, labs, immunizations, vitals, documents, timeline, caregivers, advance directives, emergency card.

Retrieval inside the price:

- Direct patient-access connections (SMART on FHIR, fee-for-service Blue Button, a Medicare Advantage or Medicaid plan Patient Access API) have no middleware fee.
- Fasten connections are included only up to the number the Fasten contract prices inside this $10. Until that contract number is written in the sensitivity table below, the default included Fasten connection count is **zero**, and retrieval uses the direct path. Do not promise "unlimited portals" on this tier.

Also included: on-device HealthKit, Health Connect, and Bluetooth for **tested** device and OS pairs. Lazy translation of a record the member opens, with the original kept. On-device read-aloud. Cloud speech is metered separately and is not one shared "10 minutes of speech."

Essential read-aloud, when the phone has no on-device voice for that language, is an accommodation and is not hard-stopped. Optional dictation is capped. The screen always shows the same words.

## Google Cloud, the part that was already right

Shared floor, `us-central1`, Cloud SQL Enterprise, non-HA, request-based Cloud Run. There is no HIPAA surcharge on these prices. A second zone is a product decision, not a sentence in a pricing doc. The consolidation plan sets the availability gate.

| Piece | Assumption | USD / month |
| --- | --- | ---: |
| Cloud SQL, 1 vCPU | 730 h × $0.0413 | 30.15 |
| Cloud SQL, 3.75 GiB RAM | 730 h × 3.75 × $0.007 | 19.16 |
| SSD, 20 GiB | × $0.17 | 3.40 |
| Backups, 20 GiB | × $0.08 | 1.60 |
| Secret Manager and Cloud KMS | a handful of keys | 2 |
| FHIR operations, logging past the free tier, GCS for a small corpus | budget until the first real month | 10 |
| **Floor in the original note** | | **66.31** |

Add these fixed pieces before calling the floor complete:

| Piece | Why it is here | USD / month |
| --- | --- | ---: |
| External Application Load Balancer, if Cloud Armor is on | Cloud Armor attaches to a load balancer. A forwarding rule is on the order of $18, plus policy and rules. Budget **$25**. | 25 |
| One warm Cloud Run instance | Scale-to-zero drops in-memory state and makes the first open slow on a cheap phone. Budget **$15** until measured. | 15 |
| **Floor used below** | 66.31 + 25 + 15 | **106** |

At 1,000 active members that floor is about **$0.11** each per month. At 200 members it is about **$0.53**. These are Google Cloud figures only.

Marginal Google Cloud for one active member, before speech and translation:

| Piece | Assumption | USD / member / month |
| --- | --- | ---: |
| Cloud Run | 240 requests × 0.3 s × 1 vCPU × $0.000024, plus memory | about 0.002 |
| GCS | 50 MB × $0.020/GB | 0.001 |
| Egress | 50 MB × about $0.12/GB | 0.006 |

Device streams are aggregated to hourly summaries, or stored as sampled data, before they are written. A heart-rate sample every five minutes is thousands of FHIR writes a month and is not the design.

Healthcare API storage, notifications, and data-access audit logs are usage-priced. The $10 pool above is a placeholder, not a measurement. Data-access audit logs are turned on. They count toward logging ingestion.

## Costs the $10 has to cover besides Google Cloud

| Cost | How it is counted | Effect |
| --- | --- | --- |
| Card fee on $10 once a year | 2.9% + $0.30 | **$0.59 / year**, about $0.05 / month |
| Card fee on a $1 monthly charge | Same rate | About **$0.33 / month**. Not offered |
| Fasten | Per connection per year. **Contract number not in this repo.** | See the sensitivity table. Each $1 per connection per year is about $0.083 / month |
| Translation | Lazy. Cache per resource and language. Do not translate a chart on import | A full chart translated eagerly can be a few dollars once (Cloud Translation is on the order of $20 per million characters, **verify**). On-view translation of what the member opens is cents, cached |
| Speech-to-text | Meter **minutes**. Logging stays off, which is the higher v1 price if v1 is used. Do not budget the $0.016 figure for logging-off medical dictation. Non-English uses a standard or Chirp model. The medical model is English-only and capped | Confirm the price page. A reviewer estimate of the medical model was well above standard recognition (on the order of $0.078 / minute, so 10 minutes is on the order of $0.78). **Verify** before setting the cap |
| Text-to-speech | Meter **characters**, not minutes. Neural voices cost more than standard | A short read-aloud is cents. It is not the same pool as speech-to-text |
| Support | Not Google Cloud | One phone call costs more than a year of the tier. The household plan and sponsors carry support. The $10 tier uses in-app help in the member's language and does not include a call center |
| Audits, insurance, a BAA fax vendor | Annual fixed | Five-figure costs divided by the whole membership, not by this tier alone |

### Fasten sensitivity

Gross revenue is $10 / year. After the card fee, about **$9.41** is left for the year, about **$0.78** a month.

| Fasten price per connection per year | 1 connection | 2 connections | Fits inside $9.41? |
| --- | ---: | ---: | --- |
| $0 (direct SMART / Blue Button only) | $0 | $0 | Yes |
| $1 **assumption** | $1 | $2 | Yes, tight on two |
| $3 **assumption** | $3 | $6 | One connection fits. Two connections ($6) plus speech and translation can exceed the net |
| $5 **assumption** | $5 | $10 | Two connections exceed the net before Google Cloud |

Until the contract is pasted into this table, the $10 tier includes direct connections and does not include a metered Fasten connection. A flat Fasten platform fee, paid as overhead the way Cloud SQL is paid, can be added the day the invoice is known. A per-connection fee that does not fit is a sponsor cost, not a surprise on the member's card.

## Scenarios at 1,000 active members

Per member per month. Fasten at $3 / connection / year is an **assumption**, not a quote.

| Scenario | Google Cloud | Card | Fasten | Translation and speech | Total | Against $0.78 net |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Original $1 monthly card, eager translation, medical dictation | ~0.25 | 0.33 | 0.50 (2 × $3) | translation amortized plus medical STT can pass $1 | above $2 | The $1 price loses money |
| **This tier: $10 / year, direct connections, lazy translation, on-device speech** | ~0.11 to 0.30 | 0.05 | 0 | cents, unless the accommodation path uses cloud TTS | **about $0.20 to $0.40** | Fits |
| Same, plus one Fasten connection at $3 / year | ~0.11 to 0.30 | 0.05 | 0.25 | cents | **about $0.45 to $0.65** | Fits if speech stays small |
| Sponsor ACH, direct connections, sponsor pays Fasten | ~0.11 to 0.30 | ~0 | 0 on the member | cents | **about $0.15 to $0.30** of Google Cloud | The member pays $0 |

"$0.15 to $0.40" in the first version of this page was a Google Cloud range. It is not a fully loaded operating cost. Fully loaded, this tier works when Fasten is absent or capped, translation is lazy, and speech is on-device first. It does not work as a $1 monthly card charge.

## Stop-loss before launch

Enrollment pauses if any of these trip, until the price or the contract changes:

- Fasten's bill for this tier exceeds the net $10 revenue for those members.
- Median cloud speech plus translation for the tier exceeds $2 / member / year.
- Support contacts on the tier exceed one contact per member per year.
- Active members stay under 100 for a quarter and no sponsor is covering the ~$106 floor. The household plan or a grant covers that floor. The beneficiary price does not rise to fill it.

## Eligibility

Store the result of the check. Do not store a Social Security number, and do not ask for a photo of an insurance card in this tier.

1. **Attestation.** The member states Medicaid, Medicare fee-for-service, Medicare Advantage, or more than one of those, plus the state for Medicaid, and the date. They confirm again every 12 months.
2. **Fee-for-service Medicare, stronger check.** A completed CMS Blue Button 2.0 authorization proves fee-for-service Medicare. It is claims data (Parts A, B, and D), not a clinical chart, and it is not the Medicare Advantage record. Using that authorization as proof of the discount is a second purpose. Ask for it separately, keep it optional, and do not collect Medicare.gov passwords.
3. **Medicare Advantage.** The plan's own Patient Access API, when we have registered with that plan. Blue Button will not show that plan's encounters.
4. **Medicaid.** The managed-care plan's Patient Access API when that plan is connected. There is no single state API for most members. Until the plan is connected, attestation is the check.
5. **Dual eligible.** Either proof is enough.

A failed re-check keeps the record. It does not convert the account to a paid household plan by itself.

## What this price is not

It is not a bid or a claim that the service is free to operate. It is the public price for a government-program beneficiary, set so the Google Cloud cost, the card fee, and a capped retrieval path can fit inside $10 a year once a few hundred people share one small database. Confirm the Fasten invoice and the speech price page, with data logging off, before the first charge.
