# I-693 Quick-Turnaround Service — DMV Immigration Attorney Outreach

Campaign kit for emailing immigration attorneys across DC, Maryland, and Northern
Virginia to promote the fast-turnaround USCIS Form I-693 (Report of Immigration
Medical Examination and Vaccination Record) service at Lansdowne Travel & Family
Medicine (Dr. Rajiv Aggarwal, USCIS-designated civil surgeon).

## Contents

| File | Purpose |
|------|---------|
| `email-1-intro.md` | Primary cold email. 5 subject-line variants + plain-text body. |
| `email-1-intro.html` | Same email, HTML version for Gmail / mail-merge tools. |
| `email-2-followup.md` | Day +4 follow-up (short, reply-to-thread). |
| `email-3-final.md` | Day +10 final touch (value add: attorney referral card). |
| `attorney-referral-card.md` | One-page "what to tell your client" handout attorneys can forward. |
| `recipients-template.csv` | Column layout for the send list. Fill this before sending. |
| `build-recipient-list.md` | Where to source DMV immigration attorney emails, and the Apollo query. |
| `merge_send.py` | Mail-merge script: renders per-recipient emails, optional SMTP send with throttling. |
| `compliance-checklist.md` | CAN-SPAM, HIPAA, Virginia/Maryland/DC advertising rules, and pre-send QA. |

## Merge variables

All templates use `{{VAR}}` tokens. Defaults live in `merge_send.py` (`DEFAULTS`).
Confirm these before the first send:

| Variable | Default | Notes |
|----------|---------|-------|
| `I693_FEE` | `$250 per applicant, all-inclusive` | Confirmed by Dr. Aggarwal (Sep 2026): covers paperwork, labs, and age-appropriate immunizations. |
| `TURNAROUND` | `2–3 business days` | Sealed I-693 ready after lab results return. |
| `APPT_LEAD` | `same or next business day` | Exam appointment availability. |
| `RESTON_ADDRESS` | `Reston, VA (address on request)` | Fill in the Reston suite address before sending. |
| `BOOKING_URL` | `https://lansdownedoctor.com` | Replace with a direct scheduling link if one exists. |
| `FIRST_NAME` | per-row | From CSV. Falls back to "Counsel" if blank. |
| `FIRM` | per-row | From CSV. Falls back to "your firm". |

## Send plan

| Day | Email | Notes |
|-----|-------|-------|
| 0 (Tue/Wed, 9–10 AM ET) | Email 1 | Batches of ≤50/hour from the practice domain, not Gmail, to protect deliverability. |
| +4 | Email 2 | Sent as a reply in the same thread (`In-Reply-To`). |
| +10 | Email 3 | Attach `attorney-referral-card.md` rendered as PDF. |
| +14 | Phone follow-up | Call firms that opened twice but did not reply. |

## Assumptions made (confirm or edit)

1. Fee is $250 per applicant and includes the exam, completed I-693, required labs, and age-appropriate immunizations (confirmed Sep 2026).
2. Sealed I-693 turnaround is 2–3 business days after labs result (IGRA TB blood test is the gating step).
3. The Reston office address is not in the codebase or recent email; it is a placeholder.
4. Sending domain is `lansdownedoctor.com` (reply-to `docs@lansdownedoctor.com`). SPF/DKIM must be set up on that domain before a bulk send.
