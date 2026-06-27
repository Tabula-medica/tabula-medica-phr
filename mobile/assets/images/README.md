# App icon + splash assets (REQUIRED before `eas build`)

Drop the Tabula Medica brand assets here. `eas build` fails without `icon.png`.

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024×1024 px, no alpha | Main app icon (iOS + Android legacy) |
| `splash-icon.png` | ~1024×1024, transparent ok | Centered on `#1a3a52` splash |
| `android-icon-foreground.png` | 1024×1024, safe-zone centered | Adaptive-icon foreground (bg = `#1a3a52`) |
| `favicon.png` | 48×48 | Optional (web target) |

Brand: deep teal `#1a3a52`, accent `#0ea5e9`. The original export shipped no
logo PNG — supply one (or a designer export) and these slots are filled.
