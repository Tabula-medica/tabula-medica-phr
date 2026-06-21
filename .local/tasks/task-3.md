---
title: Patient-facing CMS-1500 (CF-142) insurance claim form
---
# Patient-Facing CMS-1500 Claim Form View

## What & Why
Patients often receive Explanation of Benefits (EOB) and billing statements but have no way to see or understand the standard CMS-1500 (formerly CF-142/HCFA-1500) claim form that providers submit to insurers on their behalf. Adding a patient-friendly CMS-1500 view helps patients understand what was billed, verify accuracy, and have a printable form they can use for manual insurance submissions, reimbursement requests, or records.

## Done looks like
- A new "Insurance Claims" section/tab within the existing Bills & EOB page (or as a standalone page at `/insurance-claims` if the Bills & EOB page is too crowded)
- A CMS-1500 form template that displays claim data in the standard 33-box layout patients and providers recognize, with patient-friendly labels explaining each field
- Users can create a new claim form by entering: patient info (auto-populated from profile), insurance info (auto-populated from onboarding), provider info, diagnosis codes (ICD-10), procedure codes (CPT), dates of service, and charges
- A read-only "claim explainer" mode that shows tooltips or inline explanations for each box (e.g., Box 21 = "Diagnosis codes — what your provider identified", Box 24 = "Services — what was done and how much it cost")
- Print-friendly layout that matches the standard CMS-1500 format for paper submission
- PDF export option
- Integration with existing Bills & EOB data — if a user has uploaded bills, they can view them in CMS-1500 format
- NO-CDS disclaimer: form is for documentation/reference only, not a substitute for provider-submitted claims

## Out of scope
- Electronic claim submission to payers (that requires clearinghouse integration)
- Real-time eligibility checking
- Automated CPT/ICD code lookup or validation
- Provider-side claim management

## Tasks
1. **CMS-1500 data model** — Define the TypeScript interfaces matching the standard 33-box CMS-1500 layout: patient info, insured info, referring provider, diagnosis codes (up to 12), service lines (up to 6 with CPT, modifiers, charges, units), provider info, and totals.

2. **CMS-1500 form component** — Build a reusable form component that renders the standard CMS-1500 layout with all 33 boxes, auto-populates patient and insurance data from the user's profile, and allows manual entry of diagnosis codes, procedures, dates of service, and charges.

3. **Claim explainer overlay** — Add an educational "explain this form" toggle that shows patient-friendly descriptions for each box on the CMS-1500 form.

4. **Print and PDF export** — Add print-optimized CSS that renders the form in the recognized CMS-1500 layout, plus a PDF download option.

5. **Page and navigation** — Create the claims page, register the route, add it to the sidebar near Bills & EOB, and link from the existing Bills & EOB page.

## Relevant files
- `client/src/pages/bills-eob.tsx`
- `server/routes/bills-eob-routes.ts`
- `client/src/components/app-sidebar.tsx`
- `client/src/App.tsx`