# Compliance and pre-send checklist

## CAN-SPAM (federal)
- [ ] Accurate From / Reply-To (`docs@lansdownedoctor.com`), no misleading subject
- [ ] Physical mailing address in every message (19415 Deerfield Ave., Suite 103, Lansdowne, VA 20176)
- [ ] Clear opt-out ("reply unsubscribe") honored within 10 business days
- [ ] Suppression list maintained in `recipients-template.csv` `notes` column

## HIPAA
- [ ] No patient names, cases, or identifiable details in any email or attachment
- [ ] Attorney replies that include client PHI go into the practice EHR, not Gmail
- [ ] Do not send from `rajivka4@gmail.com`; use the practice domain

## Professional advertising (VA Board of Medicine, MD, DC)
- [ ] "USCIS-Designated Civil Surgeon" is accurate and current (verify designation status in the USCIS Find a Civil Surgeon locator before sending)
- [ ] No guarantees of USCIS approval; turnaround claims are about the clinic's own timeline
- [ ] Fee quoted ($250 for exam and paperwork) matches the front desk; labs and vaccines are stated as extra in every message
- [ ] No fee-splitting, referral payments, or gifts offered to attorneys

## Deliverability
- [ ] SPF, DKIM, DMARC published for `lansdownedoctor.com`
- [ ] Warm-up: ≤50 emails/hour, ≤200/day for the first week
- [ ] Plain-text alternative included with HTML
- [ ] Test send to Gmail, Outlook, and iCloud; check spam placement

## Content QA
- [ ] `RESTON_ADDRESS` filled in
- [ ] `I693_FEE` and `TURNAROUND` confirmed by the office
- [ ] Booking URL resolves
- [ ] Phone and fax numbers dial correctly
