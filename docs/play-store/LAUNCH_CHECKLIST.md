# Google Play launch checklist

One list of everything between today and a Google Play release, in the order it can be done. Each line
says **who** can do it and **how we know** it is done. Last checked: 14 October 2026.

Nothing on this list is ticked unless it was seen to be true on that date. "Not verifiable" means the state
cannot be read from outside the owner's dashboards.

**Who:**
- **Code**: a change in this repository. Can be done by any developer.
- **Owner: dashboard**: a setting in Supabase, Vercel, Google Cloud or Google AI Studio.
- **Owner: legal**: a decision or text that needs the owner, ideally with legal advice.
- **Owner: account / payment**: an account, a registration, or a payment.
- **Owner: device**: testing on a real Android phone.

## 0. Do first: security

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 0.1 | Change the passwords of the admin, vet and farmer accounts that were in the public repository (admin first), and anywhere the same passwords are used | Owner: dashboard | **Not verifiable**. Must not be checked by signing in with the leaked passwords | The owner confirms. Procedure below |
| 0.2 | Sign the admin user out of every session | Owner: dashboard | **Not verifiable** | As above |

**Safest procedure for 0.1 and 0.2.** For each of the three accounts: sign in to the app as that account
with its current password, open the reset flow (`/forgot-password`) or change it from the Supabase
dashboard (Authentication > Users > the user > Send password recovery), and choose a new long password kept
in a password manager. Then in Supabase, Authentication > Users > the admin user > "Sign out user" (or
"Log out of all sessions"), so any session opened with the old password ends. Do the admin first. If any of
the three passwords is used on another service (email, GitHub, Google), change it there too.

## 1. Accounts and sign-in (Supabase)

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 1.1 | Site URL is the public address | Owner: dashboard | **Done** (14 Oct) | `npm run check:auth-urls` |
| 1.2 | Redirect URLs include `https://<production domain>/**` | Owner: dashboard | **Done** for `farmers-connect-azure.vercel.app` (14 Oct). Repeat if the domain changes | `npm run check:auth-urls` |
| 1.3 | Anonymous sign-ins off | Owner: dashboard | **Done** (14 Oct) | `/auth/v1/settings` reports `anonymous_users: false` |
| 1.4 | "Confirm email" on | Owner: dashboard | **Done** (14 Oct) | `/auth/v1/settings` reports `mailer_autoconfirm: false` |
| 1.5 | The app handles confirmation (sign-up says to open the link, can resend; login explains) | Code | **Done** on branch `fix/email-confirmation-signup`; live once merged | `tests/e2e/email-confirmation.test.js` |
| 1.6 | An email service (SMTP) in Supabase, so confirmation and password-reset emails actually arrive | Owner: dashboard (and possibly payment) | **Not verifiable** from outside | Authentication > Emails > SMTP Settings shows a custom sender. Then sign up with a real address of your own and confirm the email arrives within minutes |
| 1.7 | Email templates mention Farmers Connect and come from an address you own | Owner: dashboard | Not checked | Authentication > Emails > Templates |
| 1.8 | Google sign-in consent screen is "In production", not "Testing" | Owner: dashboard (Google Cloud) | **Not verifiable** | Google Cloud console > APIs & Services > OAuth consent screen |
| 1.9 | Phone sign-up: decide whether to keep it without SMS confirmation (`phone_autoconfirm` is on) | Owner: decision (an SMS provider costs money per message) | Open | `/auth/v1/settings` reports `phone_autoconfirm` |

## 2. Policies and the operator

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 2.1 | Read the Privacy Policy (`/privacy`) and Terms (`/terms`), ideally with someone qualified in Kenyan law | Owner: legal | Open | |
| 2.2 | Legal operator name and support email in `src/config/legal.js` (`OPERATOR_LEGAL_NAME`, `CONTACT_EMAIL`; `POSTAL_ADDRESS` if wanted) | Owner: legal, then Code | **Empty** | The file |
| 2.3 | Publish: set `VITE_POLICIES_PUBLISHED=true` in Vercel (Production) and redeploy | Owner: dashboard | **Not published** | Signed out, `https://<domain>/privacy` shows the policy, not the home page |
| 2.4 | A support inbox that someone reads every working day; the same address in 2.2 and in Play Console | Owner: account | Open | |
| 2.5 | Gemini plan decided. On the free plan Google may use prompts to improve its products; the policy and the Clucky consent screen must say what is true | Owner: payment + legal | **Free plan** (per the owner, 12 Oct) | Google AI Studio > Billing. If paid, update `/privacy` section 6 and `data-audit.md` |
| 2.6 | Supabase project region confirmed and stated in the policy if outside Kenya | Owner: dashboard | **Not verifiable** | Supabase > Project settings > General |

## 3. Domain and Android identity (decide once, before the first build)

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 3.1 | Production domain. Today `farmers-connect-azure.vercel.app`; your own domain is strongly recommended | Owner: decision + payment | Open | |
| 3.2 | Android application ID. Proposed `ke.co.farmersconnect.app`. **Permanent after the first upload** | Owner: decision | Open | `android/twa-manifest.json` |
| 3.3 | If the domain changes: Vercel domain, Supabase Site URL and Redirect URLs, `android/twa-manifest.json`, `check:auth-urls` script address, `CLUCKY_ALLOWED_ORIGINS` | Owner: dashboard + Code | n/a until 3.1 | `npm run check:auth-urls` |

## 4. Android build and signing

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 4.1 | A machine with Node 20+, JDK 17 and the Android command-line tools (Bubblewrap can download the last two) and 10 GB free | Owner | **This machine has no Java or Android SDK** | `java -version` |
| 4.2 | `bubblewrap init` from `android/`, then confirm `targetSdkVersion 36` in `app/build.gradle` | Owner (or a developer with the tools) | **Not built** | `android-release.md` |
| 4.3 | Upload key created by `bubblewrap init`; key store and passwords in a password manager plus one offline backup; **never committed** | Owner | **No key exists** | `.gitignore` excludes `*.keystore`, `*.jks`; `npm run check:repo` fails if one is tracked |
| 4.4 | Enrol in Play App Signing when creating the app in Play Console | Owner: account | Open | Play Console > Setup > App signing |
| 4.5 | `bubblewrap build` produces the `.aab` | Owner | Not built | |

## 5. Digital Asset Links

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 5.1 | Copy `public/.well-known/assetlinks.json.example` to `assetlinks.json` with the application ID and the SHA-256 fingerprint(s) from Play Console > App signing | Code (with the owner's fingerprint) | **Template only** | |
| 5.2 | Merge; the file is served as JSON at `https://<domain>/.well-known/assetlinks.json` | Code | Not published. Today that address returns the app's HTML page | Open it signed out: it must show JSON, not a web page |
| 5.3 | Google's checker confirms the link | Owner | Open | `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<domain>&relation=delegate_permission/common.handle_all_urls` |

## 6. Reviewer accounts

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 6.1 | A farmer account with one batch | Owner | Open | Signs in on a phone; dashboard not empty |
| 6.2 | A vet account, profile approved from the admin account | Owner | Open | Vet dashboard opens |
| 6.3 | A supplier account, profile approved, one product | Owner | Open | Supplier dashboard opens |
| 6.4 | Passwords kept outside the repository; entered only in Play Console > App content > App access | Owner | Open | `npm run check:repo` |

With email confirmation on, each reviewer account must be confirmed through its email before it can sign
in. Use addresses you can read. Never give reviewers the admin account.

## 7. Play Console

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 7.1 | Developer account created (one-time fee, identity verification); personal or organisation chosen | Owner: account + payment | **Unknown to this repository** | |
| 7.2 | Store listing: name, short and full description, icon, feature graphic (1024 x 500), 2 to 8 phone screenshots | Owner (drafts in `store-listing.md`) | Drafted; graphics not made | |
| 7.3 | Privacy policy URL | Owner: console | Waits on 2.3 | |
| 7.4 | Data safety form | Owner: console | Worksheet ready: `data-safety-worksheet.md`. Items marked P depend on provider facts (2.5, 2.6) | |
| 7.5 | Account deletion URL: `https://<domain>/delete-account` | Owner: console | The page is live and works signed out | Open it in a private window |
| 7.6 | Content rating questionnaire | Owner: console | Facts in `store-listing.md` section 4 | |
| 7.7 | Target audience: 18 and over only | Owner: console | Decided in the terms | |
| 7.8 | Ads declaration: no ads | Owner: console | True today | |
| 7.9 | App access: reviewer accounts and instructions (section 6) | Owner: console | Waits on 6 | |
| 7.10 | Generative AI declaration if asked: Clucky, text only, with in-app reporting | Owner: console | Built and verified | `policy-matrix.md` section 5 |

## 8. Testing tracks

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 8.1 | Internal test on the owner's own phones, using the device list in `android-release.md` | Owner: device | **Never run on Android** | |
| 8.2 | Personal account created after 13 November 2023: closed test with at least 12 testers opted in for at least 14 days in a row, then apply for production access | Owner: device + account | Applies only to a personal account | Play Console > Testing |
| 8.3 | Notes kept during the test: how testers were found, what they used, what they reported, what changed | Owner | Open | The production-access form asks for this |

## 9. Running it after launch

| # | Item | Who | State | How to check |
| --- | --- | --- | --- | --- |
| 9.1 | Named person who reviews Admin > Requests and community reports, and how often | Owner | Open | `moderation-runbook.md` |
| 9.2 | Optional second fence on the edge functions: `CLUCKY_ALLOWED_ORIGINS`, `ACCOUNT_ALLOWED_ORIGINS` set to the production address | Owner: dashboard | Not set (14 Oct) | `npx supabase secrets list` shows the names |
| 9.3 | Optional cap before Gemini's free allowance runs out: `CLUCKY_GLOBAL_DAILY_LIMIT` | Owner: dashboard | Not set (14 Oct) | As above |

## What already works and is verified

These need no action, and are listed so they are not redone:

- Account deletion in the app and at `/delete-account`, and the public request form (`tests/e2e/account.test.js`, database checks D0 to D9; the live end-to-end deletion was proven on 13 October).
- Reporting and blocking for listings, members and Clucky answers (`tests/e2e/safety.test.js`).
- Clucky asks for consent before the first question, and the deployed function refuses without it (`npm run test:clucky-live`, 6 of 6 on 13 October).
- Password recovery by email (`tests/e2e/password-reset.test.js`). It depends on 1.6 to deliver the email.
- Photo files cannot be listed by visitors; access rules hold (`npm run test:security`, 129 of 129).
