# Mobile iOS Pipeline — One-Click Build & Submit

GitHub Actions workflow that builds the iOS app on EAS and submits it to App Store Connect with one click.

Workflow file: `.github/workflows/mobile-ios-submit.yml` (in the **web** repo, `Tabula-medica/Tabula-Medica-web-version`).

## One-time setup

### 1. Add 5 GitHub Actions secrets to the web repo

Open: `https://github.com/Tabula-medica/Tabula-Medica-web-version/settings/secrets/actions` → **New repository secret** for each of:

| Secret name | Source | Purpose |
|---|---|---|
| `EXPO_TOKEN` | Expo dashboard → Settings → Access Tokens | EAS CLI auth |
| `APPLE_ID` | Your Apple Developer email | App Store Connect login |
| `APPLE_APP_SPECIFIC_PASSWORD` | https://appleid.apple.com → Sign-in & Security → App-Specific Passwords | Bypasses 2FA for `eas submit` |
| `APPLE_TEAM_ID` | https://developer.apple.com/account → Membership (10-char ID) | Apple Developer Team |
| `ASC_APP_ID` | App Store Connect → My Apps → Tabula Medica → App Information → Apple ID (numeric) | Identifies which app to submit to |

> The same five values are already in your Replit Secrets — copy them across (Replit doesn't share secrets with GitHub automatically).

### 2. Register iOS credentials with EAS (one-time, interactive)

The very first iOS build needs Apple distribution certs and provisioning profiles registered with EAS. Run **once** from your local machine or the mobile Replit shell:

```bash
cd tabula-medica-mobile
npx eas-cli@latest credentials
# Choose: iOS → production → set up Distribution Certificate + Provisioning Profile
# Sign in with your Apple ID when prompted (2FA code via SMS/device)
```

Once done, EAS stores the credentials and CI runs are fully non-interactive.

## Running the pipeline

1. Go to: `https://github.com/Tabula-medica/Tabula-Medica-web-version/actions/workflows/mobile-ios-submit.yml`
2. Click **Run workflow** (top right)
3. Pick:
   - **action**: `build-and-submit` (default) | `build` only | `submit` latest only
   - **profile**: `production` (default) | `preview` | `development`
4. Click **Run workflow**

The job runs ~25–60 min for a build, ~2–5 min for a submit. Watch progress in the Actions tab.

## What the workflow does

1. Checks out repo (web repo, mobile code lives in `tabula-medica-mobile/`)
2. `npm ci` inside `tabula-medica-mobile/`
3. `eas-cli whoami` — confirms `EXPO_TOKEN` is valid
4. `eas build --platform ios --profile <profile> --non-interactive --wait` — builds the IPA on EAS servers, autoincrements `buildNumber`
5. `eas submit --platform ios --profile production --latest --non-interactive` — uploads the IPA to App Store Connect and triggers Apple's processing

After the workflow succeeds, the build appears in App Store Connect → TestFlight (or directly under your version awaiting review, depending on your setup) within ~10–30 min.

## Troubleshooting

- **"Apple Authentication failed"** — `APPLE_APP_SPECIFIC_PASSWORD` is wrong/expired. Generate a new one at appleid.apple.com.
- **"No build found to submit"** — `eas build` step didn't complete or you ran `submit` alone with no recent build. Use `build-and-submit`.
- **"Project not found" / "Unauthorized"** — `EXPO_TOKEN` revoked or wrong account. Regenerate at expo.dev → Settings → Access Tokens.
- **"Invalid distribution certificate"** — Re-run `npx eas-cli credentials` interactively to refresh certs.
- **App Store rejects the binary** — read the rejection in App Store Connect; common ones (encryption export compliance, missing privacy strings) are pre-handled in `app.config.js`.
