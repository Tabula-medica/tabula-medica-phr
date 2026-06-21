---
title: Secure family member onboarding hub with multi-member data management
---
# Secure Family Member Onboarding Hub

## What & Why
Patients need a centralized, secure, and methodical way to add family members (children, elderly parents, spouses, dependents) to their Tabula Medica account and manage health data for multiple members simultaneously. Today the pieces exist (profile switcher, family verification, caregiver portal) but they're scattered across separate pages with no unified flow. This task creates a single "My Family" hub that ties everything together with a guided, secure onboarding wizard for each family member — including legal verification, identity authentication, and the ability to enter health data for multiple members side-by-side without switching contexts.

## Done looks like
- A new "My Family" page at `/my-family` accessible from the sidebar, serving as the centralized hub for all family-related management (profiles, pets, caregivers)
- A guided "Add Family Member" wizard with steps: (1) Relationship selection (child under 18, adult dependent, spouse, elderly parent), (2) Identity & demographics (name, DOB, gender, insurance), (3) Legal verification with document upload (birth certificate, guardianship papers, HPOA, marriage cert) and digital attestation, (4) Health profile setup (conditions, medications, allergies — same quick-add pattern as onboarding), (5) Confirmation with generated profile
- Authentication requirements enforced: user must be logged in, must re-verify password/MFA before adding a family member, session validation throughout the wizard
- Multi-member data dashboard: after onboarding, the hub shows all family members as cards with quick access to each member's health data; user can view and enter data for multiple members without full context switching (e.g., a medication list or appointment entry that lets you pick which family member it's for)
- Pet health records integrated into the same hub — the existing Pet Health Records page content is accessible from the "My Family" hub as a "Pets" section
- Links to existing Family Verification page for pending/active verifications and Caregiver Portal for managing external caregivers
- HIPAA-compliant audit logging for all family member access and data entry
- Sidebar entry consolidates: "My Family" replaces or groups the separate "Caregivers" and "Family Verification" entries

## Out of scope
- Rebuilding the existing profile switcher component (keep it as-is in the header)
- Rebuilding the existing caregiver invitation/permissions system (link to it from the hub)
- EHR data import for family members (that stays in the onboarding wizard)
- Billing or insurance claim management for family members

## Tasks
1. **Family hub page** — Create the `/my-family` page with member cards grid showing all profiles (self, family, pets), each card displaying name, relationship, age, key health stats, and quick-action buttons (view records, add data, manage access).

2. **Add Family Member wizard** — Build a multi-step onboarding wizard within the hub: relationship selection → identity/demographics → legal verification with document upload and attestation → health profile quick-setup (conditions, meds, allergies with quick-add badges) → confirmation. Each step validates before proceeding.

3. **Security layer** — Add re-authentication gate before the wizard starts (password re-entry or MFA challenge), enforce authenticated session throughout, and log all family member creation/access events to the HIPAA audit trail.

4. **Multi-member data entry** — Add a "family-wide" view mode where the user can see a tabbed or side-by-side view of multiple members' key data (medications, conditions, upcoming appointments) and add entries for any member without navigating away — a member selector dropdown on forms.

5. **Hub integration** — Integrate pet health records as a section/tab in the hub, add links to existing Family Verification and Caregiver Portal pages, and update the sidebar to show "My Family" as the primary entry that groups family/caregiver/pet navigation.

## Relevant files
- `client/src/pages/profile-management.tsx`
- `client/src/pages/family-verification.tsx`
- `client/src/pages/caregivers.tsx`
- `client/src/pages/caregiver-portal.tsx`
- `client/src/pages/pet-health-records.tsx`
- `client/src/components/profile-switcher.tsx`
- `server/profile-routes.ts`
- `server/routes/family-verification-routes.ts`
- `server/caregiver-invitation-routes.ts`
- `server/caregiver-dashboard-routes.ts`
- `client/src/components/app-sidebar.tsx`
- `client/src/App.tsx`