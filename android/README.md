# android/

Settings for packaging Farmers Connect as an Android app (a Trusted Web Activity built with Bubblewrap).
The full guide, including signing and Digital Asset Links, is `docs/play-store/android-release.md`.

**There is no Android project or app bundle here yet.** This folder holds only the settings Bubblewrap
reads. `bubblewrap init` generates the project into this folder; the generated files, the key store and the
built `.aab` are ignored by git on purpose.

## `twa-manifest.json`

| Setting | Value | Change it? |
| --- | --- | --- |
| `packageId` | `ke.co.farmersconnect.app` | **Decide before the first upload. It can never be changed afterwards.** It should be a reversed domain you control |
| `host`, `fullScopeUrl`, `webManifestUrl`, icon URLs | `farmers-connect-azure.vercel.app` | Change all of them together if you move to your own domain. The app is tied to this address |
| `themeColor`, `backgroundColor` and their dark versions | The app's brand green, page colour, and dark page colour | Keep in step with `public/manifest.webmanifest` and `src/lib/theme.js` |
| `enableNotifications` | `false` | The app has in-app notifications only. Leave off: turning it on adds a notification permission that would have to be declared |
| `features.locationDelegation` | off | The app does not use location |
| `features.playBilling` | off | Nothing is sold in the app |
| `minSdkVersion` | 23 (Android 6) | Low-end phones in use in Kenya often run old Android versions. Chrome itself needs a newer one, so going lower gains nothing |
| target SDK | not set here | It comes from Bubblewrap's template (API 36 in version 1.27.0). Confirm it in the generated `app/build.gradle` |
| `appVersionCode` | 1 | Must go up by at least 1 for every upload to Play |
| `signingKey.path` | `./android.keystore` | Created by `bubblewrap init`. **Never commit it.** |

Signing in with Google leaves the app's address for Supabase's and Google's pages and comes back. During
that trip Android shows a thin browser bar, which is how a Trusted Web Activity signals a different site.
That is expected and cannot be removed for sites you do not own.
