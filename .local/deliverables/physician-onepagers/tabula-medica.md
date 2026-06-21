# Tabula Medica — Physician One-Pager

> **STUB — text to be pasted from user's external chat draft.**
> See `README.md` in this directory for context.
> Filed at reviewer's request (Gap 6, session 2b.5) so the canonical
> location exists in-repo before the text arrives.

## Suggested structure (until real text lands)

1. **One-line problem statement.** (~15 words.) e.g. "40 million
   uninsured Americans manage their own health records on paper or
   not at all."
2. **What Tabula Medica is.** (~30 words.) Patient-centric PWA that
   pulls SMART-on-FHIR data from any provider, encrypts it
   end-to-end, gives the patient a single timeline view.
3. **Why a physician should care.** (~40 words.) Patient walks into
   your appointment with a complete history instead of "I think I
   was on something for blood pressure." Reduces intake time;
   reduces redundant labs; reduces medication-reconciliation errors.
4. **What we want from you.** (~20 words.) Mention to peers; sign up
   one uninsured patient as a pilot; introduce us to your CMO.
5. **Contact + QR code.** Founder cell, calendar link, QR to
   `tabulamedica.health`.

## Notes for the actual draft

- HIPAA + Auth0 + GCP CMEK + zero-knowledge encryption are credibility
  anchors for a physician audience. Lead with one of them.
- $9.99/mo Pro pricing should be mentioned briefly so physicians know
  it's not "yet another VC-burned free app."
- Avoid jargon that a non-tech-savvy physician will gloss over (FHIR
  is fine; "OAuth2 PKCE flow" is not).
