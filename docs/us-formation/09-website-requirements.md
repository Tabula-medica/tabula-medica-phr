# 09 · The website — what Ad Grants actually requires

**Start this in week one.** It is the longest-lead item you fully control, and it gates the
single most valuable thing in the whole plan: $10,000 a month in free Google Search ads,
$120,000 a year, forever, for as long as you stay compliant.

The determination letter is worthless to you until there is a site for Google to review.
A thin site is the most common Ad Grants rejection.

---

## Google checks two separate things

**1. That you are a charity.** Verified by **Goodstack** (formerly Percent), Google's
verification partner, against your IRS determination. Reviews typically come back within
about a week.

**2. That your website meets the website policy.** This is a human-plus-automated review of
the actual site, and it is where applications fail.

---

## Non-negotiable technical requirements

| Requirement | Detail |
|---|---|
| **Own domain** | The site must be on a domain the organisation owns. No `wixsite.com/yourorg`, no `github.io`, no free subdomain. |
| **HTTPS** | Valid certificate, no mixed-content warnings. Free via Let's Encrypt or your host. |
| **No broken links** | Google crawls. Fix every 404 before applying. |
| **Mobile-functional** | Must work on a phone. |
| **No ads on the site** | No AdSense, no display ads, no third-party ad network. This is disqualifying. |
| **No affiliate links** | No revenue-share links, no sponsored placements. |
| **Clear description of mission and programmes** | Substantive content, not a placeholder or a one-page splash. |
| **No commercial intent** | The site must not read as selling anything. |

That last pair matters for you specifically. **Any page describing dataset sales, data
licensing, or a "marketplace" — even for de-identified data — will fail this review, and it
is the same content that endangers the exemption itself.** See `08`. Resolve it once and
both problems go away.

---

## Minimum page set

Six pages. Real content on each — a few hundred words minimum, written for a human.

| Page | Must contain |
|---|---|
| **Home** | What the organisation does, in one sentence, above the fold. The four programmes. A clear next action. |
| **About** | The purpose statement from `08`. The board, with names and one-line bios. Where you are based. The legal name and EIN. |
| **Programmes** | One page or one section per brand — Katha.kids, UHR, Noorjyoti, Unraj — using the descriptions in `08`. These become your Ad Grants landing pages, so give each its own URL. |
| **Donate** | A working donation mechanism. See below. |
| **Contact** | A real email address and a physical mailing address. Google and donors both check. |
| **Privacy policy** | Required by Google, by app stores, and by law once you touch children's or health data. |

Add **Financials / Transparency** as soon as you have a 990-N filed. Not required, but it
converts institutional donors and takes twenty minutes.

---

## The Ad Grants rules that get accounts suspended

Getting approved is the easy half. These are what get a live grant killed:

- **5% minimum click-through rate**, measured monthly. Two consecutive months below and the
  account is deactivated.
- **$2.00 maximum CPC bid** on manual bidding. Maximize Conversions bidding is permitted to
  exceed it, and is usually the right choice for exactly that reason.
- **No single-word keywords.** No overly generic keywords. Nothing with a quality score
  below 3.
- **At least 2 ad groups per campaign, 2 ads per ad group, 2 sitelink extensions.**
- **Geo-targeting must be set.** Not "all countries".
- **Conversion tracking configured, with at least one conversion per month.** Set this up
  *before* the first ad runs — a newsletter signup or a resource download counts.
- **$329 per day campaign budget cap.**
- Log in and make a meaningful change at least monthly, or the account is flagged dormant.

Budget about four hours a month to manage it. An unmanaged Ad Grant is worth zero, and the
suspension process is much slower to reverse than to trigger.

## Campaign structure for four brands on one grant

One Ad Grants account per organisation — but you may advertise **multiple domains the
organisation owns that serve its mission**. So:

```
Account: [[ORG_NAME]]
├── Campaign: Katha.kids     → 2+ ad groups → katha.kids landing pages
├── Campaign: UHR            → 2+ ad groups → UHR landing pages
├── Campaign: Noorjyoti      → 2+ ad groups → Noorjyoti landing pages
└── Campaign: Unraj          → 2+ ad groups → Unraj landing pages
```

Verify every domain in Google Search Console under the organisation's Google account before
applying. This structure is the strongest practical argument for the umbrella: four
registrations would mean four separate applications and four separate $10k grants to
qualify for, manage and keep compliant.

Keyword posture, since single-word and generic terms are banned anyway: go long-tail.
*"free moral stories for children in Hindi"* rather than *"stories"*. *"how to get copies of
my medical records"* rather than *"health records"*. This constraint pushes you toward
better-converting keywords than you would otherwise have chosen.

---

## Donations before the determination arrives

You can accept donations as soon as the corporation exists — they simply are not
tax-deductible to the donor until the determination is issued, at which point deductibility
applies retroactively to the incorporation date. Say exactly that on the Donate page:

> [[ORG_NAME]] is a Delaware non-profit corporation. Our application for recognition as a
> 501(c)(3) tax-exempt organization is pending. Once recognised, exemption applies
> retroactively to our date of incorporation, and contributions made from that date forward
> are expected to be tax-deductible to the extent allowed by law.

Do not claim to be a 501(c)(3) before the letter arrives.

**Processor options:** Zeffy charges nonprofits 0% and passes an optional tip request to the
donor — the cheapest real option. Givebutter is similar in model. Stripe offers a discounted
non-profit rate but requires the determination letter to apply it. Start on Zeffy or
Givebutter, since neither requires you to have the letter in hand.
