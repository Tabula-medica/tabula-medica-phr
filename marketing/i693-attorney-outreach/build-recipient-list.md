# Building the DMV immigration attorney list

Target: solo and small-firm immigration attorneys plus paralegals/intake managers at mid-size firms in DC, Maryland (Montgomery, Prince George's, Baltimore), and Northern Virginia (Fairfax, Loudoun, Prince William, Arlington, Alexandria). These are the people who tell AOS clients where to get the I-693.

## Sources (all public; one row per firm, general inbox or named attorney)

| Source | How |
|--------|-----|
| AILA DC Chapter lawyer search (ailalawyer.com) | Filter by DC, MD, VA; export name, firm, city, email where published. |
| Virginia State Bar member directory | Practice area "Immigration"; export public email. |
| Maryland Judiciary attorney listing + MSBA Immigration Law Section | Public firm emails. |
| DC Bar "Find a Lawyer" | Immigration practice filter. |
| USCIS-accredited nonprofits (DOJ Recognition & Accreditation roster) | Ayuda, CAIR Coalition, Catholic Charities, Just Neighbors, Legal Aid Justice Center, CASA. High-volume referrers. |
| Google Maps scrape "immigration lawyer" per city | Fill gaps; use firm contact email from website only. |
| Apollo.io | Query below. Uses credits; estimate ~1 credit per verified email. |

### Apollo query

- Person titles: `Immigration Attorney`, `Immigration Lawyer`, `Paralegal`, `Legal Assistant`, `Office Manager`
- Keywords: `immigration`, `adjustment of status`, `green card`
- Locations: `Washington, DC`, `Maryland, US`, `Virginia, US`
- Company size: 1–50
- Industry: Legal Services

## Hygiene before sending

1. Dedupe on email; one contact per firm for Email 1.
2. Drop role addresses that bounce or auto-reply (`noreply@`, `info@` is fine).
3. Remove anyone who has previously asked not to be contacted (`notes` column).
4. Verify with an email validator; target < 2% bounce.
5. Cap Day 0 at 200 recipients; scale up after deliverability is confirmed.
