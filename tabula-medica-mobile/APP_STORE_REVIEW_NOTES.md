# App Store Review Notes - Tabula Medica

## Demo Account Credentials

For testing and review purposes, please use the following demo credentials:

**Email:** demo@tabulamedica.com
**Password:** demo123

> **Note for internal teams:** The demo login endpoint is disabled by default in all environments.
> It must be explicitly enabled by setting the environment variable `ENABLE_DEMO_LOGIN=true` on the
> review/staging server before submitting to App Store review. Remove or unset this variable after
> the review cycle completes to restore the production-safe default.

## Demo Environment

The app connects to our demo/staging environment at:
**https://www.tabulamedica.digital**

This environment contains sample health records for the demo user, including:
- Sample medications
- Health conditions
- Lab results
- Immunization records
- Appointments

## Key Features to Test

### 1. Login
- Use the demo credentials above
- Biometric authentication (Face ID / Touch ID) is available after initial login

### 2. Dashboard
- View summary cards showing appointments, medications, and lab results
- Pull to refresh updates the data
- Quick actions navigate to different sections

### 3. Health Timeline
- Chronological view of health events
- Color-coded by event type (conditions, medications, observations, encounters)
- Dates and provider information displayed

### 4. PDF Export
- Generate a PDF packet of health records
- Select which sections to include
- Download and share via native share sheet

### 5. QR Code Sharing
- Generate a secure QR code to share records with providers
- Configurable expiration (1 hour, 24 hours, 7 days)
- Access code displayed for additional security
- Ability to revoke access

### 6. SMART on FHIR EHR Connection
- Connect to external Electronic Health Record systems
- Supported providers: Epic MyChart, Oracle Health (Cerner), SMART Health IT Sandbox
- Secure OAuth 2.0 + PKCE authentication flow
- Import Patient, Observation, MedicationRequest, Condition, Encounter, and Immunization resources
- Provenance tracking records source system, import timestamp, and version information

**Testing EHR Connection:**
For App Store review, the "SMART Health IT Sandbox" option connects to a public test environment. Select this option to test the OAuth flow and resource import functionality without requiring actual healthcare credentials.

## Important Notes

### Not a Medical Device
This application is for **informational purposes only**. It is designed to help patients organize and view their health records. It does not provide:
- Medical advice
- Clinical decision support
- Diagnosis or treatment recommendations

All screens include appropriate disclaimers indicating this is for informational purposes only.

### Privacy & Security
- HIPAA-compliant data handling
- End-to-end encryption for data in transit
- Secure credential storage using device keychain
- Session tokens expire after 24 hours

### Encryption Compliance
This app uses standard HTTPS (TLS 1.2+) for network communications. It does not use non-standard encryption or export-restricted cryptography.

## Contact

For any questions during the review process:
- Email: support@tabulamedica.com
- Website: https://www.tabulamedica.digital

---

Thank you for reviewing Tabula Medica!
