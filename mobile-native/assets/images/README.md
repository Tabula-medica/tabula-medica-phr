# App icons & images — PLACEHOLDERS

Every PNG in this folder is currently a copy of the repo's `logo-512x512.png`,
dropped in so `app.json` resolves and `expo start` runs. **Replace before any
store submission** with production-spec art:

| File                          | Spec                                                        |
| ----------------------------- | ---------------------------------------------------------- |
| `icon.png`                    | 1024×1024, no transparency, no rounded corners (iOS masks) |
| `splash-icon.png`             | ~1242×2436 safe-area art on `#0ea5e9`                      |
| `android-icon-foreground.png` | 1024×1024 foreground, centered in inner 66%                |
| `android-icon-background.png` | 1024×1024 solid/background layer                           |
| `android-icon-monochrome.png` | 1024×1024 single-color (Android 13 themed icons)           |
| `notification-icon.png`       | 96×96 white-on-transparent silhouette                      |
| `favicon.png`                 | 48×48 (web)                                                 |

Source brand art lives at repo root (`logo-512x512.png`) and in
`client/src/assets/`. Final assets should come from the design owner.
