# Android release guide

How Farmers Connect becomes an Android app on Google Play, what is ready, and what is not.

## Status on 13 October 2026

| Item | State |
| --- | --- |
| Packaging route chosen | **Trusted Web Activity**, built with Bubblewrap |
| Web app requirements for that route (HTTPS, manifest, icons) | In place |
| Bubblewrap settings file | Prepared: `android/twa-manifest.json` |
| Android project generated | **No** |
| Signed app bundle (`.aab`) | **No. Nothing has been built** |
| Android tools on the development machine | **None**: no Java, no Android SDK, no Gradle. The C: drive has about 7 GB free |
| Signing key | **Does not exist.** It must be created and kept by the owner |
| Digital Asset Links file | **Not published**: it needs the signing key's fingerprint |

A working web build is not an Android release. Until the steps below have been run on a machine with the
tools, there is no Android artifact to test or upload.

## Why a Trusted Web Activity

| Route | What it is | Fit |
| --- | --- | --- |
| **Trusted Web Activity (TWA)** | A thin Android app that opens the live website full screen in Chrome, with no browser bar, after proving the site and the app share an owner | **Chosen.** The app is already a responsive, HTTPS web app with a manifest. It uses no phone feature a browser cannot give it: photo upload works through the normal file picker, notifications are in-app only, and there is no location, Bluetooth, background work or payment. One codebase, and a merge to `main` updates the app with no new Play release |
| Capacitor | The web build is copied into a native WebView app; native plugins are available | Not needed today. It would mean a second build and release pipeline, updates through Play review for every change, and plugins the app would not use. Reconsider if push notifications, offline storage or a native camera flow become requirements |
| Native rewrite | A separate Android codebase | Not justified |

What a TWA means in practice:

- The phone needs Chrome 72 or later (or another browser that supports the protocol). Without it, the site
  opens in a Custom Tab with a small toolbar: usable, less polished.
- **The app is the website.** If the site is down, the app is down. There is no offline mode, by design
  (`CLAUDE.md`). Pages show a retry button on a failed load, not a blank screen.
- Sign-in persists the way it does in Chrome: the session is kept in the browser's storage.
- Google sign-in happens inside the same browser session, so it works without extra setup, provided
  Supabase's Site URL and Redirect URLs name the production address (a known open item: run
  `npm run check:auth-urls`).
- The Android back button goes back through the app's pages, then leaves the app.
- Links to other sites, WhatsApp (`wa.me`) and phone calls (`tel:`) leave the app and open the right app.

## Before you start: three decisions only the owner can make

1. **The production address.** Today it is `https://farmers-connect-azure.vercel.app`. A TWA is tied to
   one address. A domain you own (for example `app.yourname.co.ke`) is strongly recommended before the
   first release: changing address later means a new asset-links file and a new app version, and a
   `vercel.app` name can be reclaimed if the project is ever renamed.
2. **The application ID.** Prepared as `ke.co.farmersconnect.app`. It is permanent: it can never be changed
   after the first upload. It should be a reversed domain you control. Change it in
   `android/twa-manifest.json` before generating the project if you register a different domain.
3. **The developer account type**: personal or organisation. A personal account created after 13 November
   2023 must run a closed test with 12 testers for 14 days before production (`policy-matrix.md` section 7).

## What you need installed

On a machine with at least 10 GB free:

- Node.js 18 or later (already present).
- Bubblewrap: `npm install -g @bubblewrap/cli` (version 1.27.0 was current on 13 October 2026).
- A JDK 17 and the Android command-line tools. On first run Bubblewrap offers to download both into
  `~/.bubblewrap`; accept. This is about 1 GB, which is why it was not done on the development machine.

## Build steps

Run these from the repository root. Each is safe to repeat.

```bash
# 1. Generate the Android project from the prepared settings.
#    It reads the live web manifest, so the site must be deployed first.
cd android
bubblewrap init --manifest=https://<production domain>/manifest.webmanifest
#    When it asks, keep the values from twa-manifest.json. When it asks about a
#    signing key, let it create one, and choose strong passwords YOU keep.

# 2. Confirm the target API level. Google requires API 36 for new apps.
grep -n "targetSdkVersion\|compileSdkVersion\|minSdkVersion" app/build.gradle
#    Expect targetSdkVersion 36. If it is lower, update Bubblewrap and regenerate.

# 3. Build the signed bundle.
bubblewrap build
#    Produces app-release-bundle.aab (for Play) and app-release-signed.apk (for a phone).

# 4. Try it on a real phone before uploading.
adb install app-release-signed.apk
```

Until "Digital Asset Links" below is done the app opens with a browser bar at the top. That is the asset-links check
failing, and it is expected at this stage.

## Signing: the part that cannot be undone

- `bubblewrap init` creates `android.keystore`. **Whoever holds this file and its passwords can publish
  updates to the app.** Lose it, and with Play App Signing you can ask Google to reset the upload key;
  without Play App Signing you can never update the app again.
- Enrol in **Play App Signing** when creating the app in Play Console (it is the default). Google then holds
  the real signing key, and your keystore is only the upload key.
- Keep the keystore and passwords in a password manager and one offline backup. Never in the repository:
  `.gitignore` excludes `*.keystore`, `*.jks` and the generated project.
- Nothing in this repository contains a key or a password, and none was invented.

## Digital Asset Links (removes the browser bar)

1. In Play Console: Setup > App signing. Copy the **SHA-256 certificate fingerprint** of the *app signing
   key* (and of the upload key, for testing builds installed directly).
2. Copy `public/.well-known/assetlinks.json.example` to `public/.well-known/assetlinks.json` and put the
   fingerprint(s) and the application ID in it.
3. Merge to `main`. Then check, signed out, that
   `https://<production domain>/.well-known/assetlinks.json` opens and shows the JSON. `vercel.json` serves
   real files before its catch-all rewrite, so no routing change is needed. Look at the content, not the
   status: until the file exists that address answers "200" with the app's own HTML page (checked on
   13 October 2026), which Android treats as no asset links at all.
4. Verify with Google's checker:
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<production domain>&relation=delegate_permission/common.handle_all_urls`
5. Reinstall the app. The browser bar should be gone.

## Versions

- `appVersionName` is what people see ("1.0.0"). `appVersionCode` is a whole number that **must increase
  with every upload**. Both are in `android/twa-manifest.json`; `bubblewrap update` applies a change.
- Ordinary web changes do not need a new Play release. Upload a new bundle only when the icon, name,
  colours, start address, application settings or the target API level change. Google raises the required
  target API level each year, so expect at least one rebuild a year.

## What the Android app asks of the phone

A TWA built from these settings declares no dangerous permission. Photo upload uses the system file picker,
which needs none. Before uploading, read `app/src/main/AndroidManifest.xml` and confirm there is no
`<uses-permission>` beyond what Bubblewrap adds for a TWA (notification delegation is switched off in the
settings, and location delegation is off). Anything else would have to be declared in the Data safety form.

## Test before uploading

On at least one low-end Android phone and one newer one:

- [ ] Opens to the right page signed out (landing) and signed in (dashboard).
- [ ] Sign in with email, with a phone number, and with Google. Close the app, reopen: still signed in.
- [ ] Back button: goes back a page; from the first page, leaves the app.
- [ ] Take a photo and upload it (gallery, listing, community).
- [ ] Tap Call and WhatsApp on a listing: the dialler and WhatsApp open, and Back returns to the app.
- [ ] Turn on aeroplane mode on a page: a clear message and a retry button, no blank screen.
- [ ] Dark mode follows the phone when "Match my phone" is chosen.
- [ ] Largest system font size: nothing is cut off on the dashboard, a form and a dialog.
- [ ] Rotate the phone on a form: what was typed is still there.
- [ ] Delete a test account from Profile.

None of these has been run on Android. The web app passes automated layout checks at 320, 360, 390, 768 and
1280 pixels in Chromium, which is not the same thing.
