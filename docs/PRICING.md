# Pricing — Medicaid and Medicare tier

**Date:** 24 October 2026
**Status:** cost model for the patient-owned PHR. Re-check every Google Cloud price page before charging anyone. Rates below are the published on-demand figures used to size the tier, not a quote.

The tier exists so a person on Medicaid, Medicare, or both can keep a record for about what it costs to host them. The household plan that already exists in the app (`com.tabulamedica.pro.annual` on the subscription page) is how everyone else pays, and how the shared floor gets covered while the beneficiary count is small.

## Price

**$1 per member per month, or $10 per year.**

A sponsor (a plan, a clinic, a foundation) can pay that dollar. The member then pays $0 and the record is the same record. Do not build a thinner product for the cheaper price. The cap is on metered extras (cloud speech minutes and model calls), not on the chart.

App stores take a fee. Offer the $1 price on the web. If a store will not carry a $1 SKU after its fee, the member uses the web app. The store fee is not a reason to raise the price the member sees.

## What the dollar includes

- The record: conditions, medications, allergies, labs, immunizations, vitals, documents, timeline, caregivers, advance directives, emergency card.
- One direct patient-access connection (a SMART on FHIR launch, or CMS Blue Button 2.0) into the Cloud Healthcare API FHIR store.
- Fasten connections up to the number the existing Fasten contract already pays for. The Fasten BAA is signed. Fasten's per-connection fee is a platform cost, shared the way Cloud SQL is shared, and is not added on top of the $1. Confirm that contracted fee still fits before a large enrollment.
- On-device device data: Apple HealthKit, Android Health Connect, and Bluetooth LE. No aggregator fee.
- The interface in the patient's language, including right-to-left, and on-device read-aloud.
- A small cloud allowance if the phone cannot speak or hear that language: 10 minutes of Google Cloud Speech-to-Text or Text-to-Speech, and 20 short Vertex explanations. When the allowance is used up, the feature waits until next month. There is no overage charge.

Terra, Dexcom's cloud, and other off-device device vendors are outside this price until each has its own agreement and a known per-user fee. The on-device path is the one the tier ships.

## What one member costs on Google Cloud

Shared floor, `us-central1`, Cloud SQL Enterprise, non-HA, scale-to-zero Cloud Run. HA doubles the database compute and disk when you turn it on. HIPAA does not require a second zone; a tested backup does. Turn on HA when the member count makes an hour of downtime more expensive than the second instance.

| Piece | Assumption | USD / month |
| --- | --- | ---: |
| Cloud SQL, 1 vCPU | 730 h × $0.0413 | 30.15 |
| Cloud SQL, 3.75 GiB RAM | 730 h × 3.75 × $0.007 | 19.16 |
| SSD, 20 GiB | × $0.17 | 3.40 |
| Backups, 20 GiB | × $0.08 | 1.60 |
| Cloud Run, no minimum instances | idle | 0 |
| Secret Manager and Cloud KMS | a handful of keys | 2 |
| FHIR store, logging under the free tier, GCS for a small corpus | budget until the first real month is measured | 10 |
| **Floor** | | **about 66** |

Cloud SQL rates match Google's Enterprise general-purpose on-demand table for `us-central1` (vCPU $0.0413/hour, memory $0.007/GiB-hour; SSD and backup figures are the published ballpark and should be read off the calculator the day you bill). There is no HIPAA surcharge on these services. Google documents that covered customers pay the same prices as everyone else.

Marginal cost of one active member, before speech and models:

| Piece | Assumption | USD / member / month |
| --- | --- | ---: |
| Cloud Run | 240 requests × 0.3 s × 1 vCPU × $0.000024, plus 0.5 GiB memory | about 0.002 |
| GCS | 50 MB of documents × $0.020/GB | 0.001 |
| Egress | 50 MB × about $0.12/GB | 0.006 |
| Cloud speech, if the whole 10-minute allowance is used | standard recognition, on the order of $0.016/minute, data logging off | up to 0.16 |
| Vertex, if all 20 short calls are used | usage-priced; budget | up to 0.10 |

At 1,000 active members the floor is about $0.07 each. Add a cautious allowance for speech, models, and FHIR operations and the fully loaded Google Cloud cost sits around **$0.15 to $0.40 per active member per month**, as long as most read-aloud stays on the device. At 200 members the same floor is about $0.33 before allowances, still under $1. Under about 100 members the floor is the whole bill, and the household plan or a sponsor covers it so the beneficiary price can stay $1.

Identity Platform stays inside its free monthly active-user band at this size. Do not put PHI in Identity Platform profile fields. The chart lives in Cloud SQL and the FHIR store.

## What can blow the dollar

- Cloud speech or the medical speech model on every session. Default to on-device. Cap the cloud minutes.
- A Terra (or similar) fee per connected wearable. Keep that off the $1 tier.
- High-availability Cloud SQL and a warm Cloud Run instance before the member count needs them.
- Fasten, if the contract is priced per connection and nearly every member links several portals. Direct SMART and Blue Button are the cheap path for a person with one health system. Fasten is the right path when they have many. Both write the same FHIR store.

## How eligibility is checked

Store the result of the check. Do not store a Social Security number, and do not ask for a photo of a Medicaid card in this tier.

1. **Attestation, available on day one.** The member states Medicaid, Medicare, or both, plus the state of the Medicaid program, and the date. They confirm again every 12 months. A false attestation costs the program about a dollar a month. The record is not held hostage if the check fails; the account moves to the household plan at the next renewal and the data stays.
2. **Medicare, stronger check.** A completed CMS Blue Button 2.0 authorization (direct, or through Fasten when that source is in the Fasten catalog) is proof of Medicare. Keep the fact that it succeeded. The Medicare Beneficiary Identifier stays in the FHIR store with the claims, not in the login profile.
3. **Medicaid, stronger check where the API exists.** A completed connection to that state's or plan's Patient Access API counts. Many states will not be connected on day one. Those members use attestation until the direct app registration or the Fasten catalog includes their plan.
4. **Dual eligible.** Either proof is enough.

Re-check every 12 months. A failed re-check does not delete the record.

## What this price is not

It is not a bid, a grant budget, or a claim that the service is free to operate. It is the public price that stays near the Google Cloud cost of an active member once a few hundred people share one small database. Confirm Fasten's invoice and the speech price page before the first charge.
