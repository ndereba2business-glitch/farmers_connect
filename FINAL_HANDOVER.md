# Farmers Connect: final handover

Written on 14 October 2026 for whoever works on Farmers Connect next, including the owner working alone.
Everything marked **verified** was checked on that date; everything else says why it could not be.

**In one paragraph.** The web app is live at `https://farmers-connect-azure.vercel.app`, deployed from
`main`. The database and edge functions on Supabase match the repository exactly. Account deletion,
password recovery, reporting and blocking, and consent before the AI assistant are built and tested.
**Farmers Connect is not ready for Google Play submission**: there is no Android build or signing key, the
Privacy Policy and Terms are not published, and three passwords that were in the public repository still
need changing. The full list is [docs/play-store/LAUNCH_CHECKLIST.md](docs/play-store/LAUNCH_CHECKLIST.md).

## 1. Verified current status

| Area | State on 14 October 2026 | How it was checked |
| --- | --- | --- |
| Git | `main` clean and equal to GitHub; no open pull requests; no unmerged branches on GitHub | `git status`, `gh pr list`, `git branch -r --no-merged` |
| Vercel | `main` deployed to production successfully; the site answers | GitHub commit status of `main`; requests to the live site. The Vercel connector was refused access to the team, so environment variables in Vercel could not be read |
| Database | All 26 migrations in `supabase/migrations/` are applied to production, none missing either way | `npx supabase migration list --linked` |
| Edge functions | `clucky`, `delete-account`, `account-request` and `send-vaccine-reminder` are deployed and byte-for-byte the same as the repository | Downloaded with `supabase functions download` and compared |
| Function secrets (names only) | `GEMINI_API_KEY`, `AFRICASTALKING_API_KEY`, plus the ones Supabase provides itself. None of the optional Clucky or origin settings is set, so defaults apply | `npx supabase secrets list` |
| Sign-in settings | Google, email and phone on. **Anonymous sign-ins off. Email confirmation on. Site URL correct.** Phone sign-ups are still accepted without SMS confirmation | Public `/auth/v1/settings`; `npm run check:auth-urls` (4 of 4 ok) |
| Email delivery | **Not verifiable from outside.** With confirmation on, every new email account depends on Supabase sending email | Owner to check (section 5) |
| Security fixes | Leaked test logins removed from the repository (PR #39); photo listing closed, sign-up profile inheritance closed, password recovery, dependency advisories cleared (PR #40); account deletion, reporting, blocking, AI consent (PR #35) | `npm run test:security` 129 of 129 against production; `npm audit` 0 |
| The three leaked passwords | **Not verifiable.** Checking would mean signing in with them, which must not be done | Owner to confirm |

## 2. Changes made in this session

On branch `fix/email-confirmation-signup` (merged by the pull request that carries this file):

1. **Sign-up works with email confirmation switched on.** The owner turned on "Confirm email" in Supabase.
   The app still said "Account created successfully!" and moved the person into the app with no session;
   logging in then showed Supabase's bare "Email not confirmed". Now sign-up says to open the link, names the
   address, can send it again, and the link brings the person back signed in. Login explains an unconfirmed
   address and offers the link again, and words wrong details, rate limits and lost connections plainly. The
   sign-up page reveals nothing about which addresses already have accounts. Sign-up's minimum password
   length is now 8, the same as the reset page. (`src/lib/authMessages.js`, `Signup.jsx`, `Login.jsx`)
2. **Saves that failed silently now say so.** Ask Vet questions, tasks, finance records, a batch's
   vaccination schedule, ticking a vaccination, deleting or completing a batch, logging an activity, and the
   bird count after deaths. Before, a failed save emptied the form and could even send a "Task Added" or
   "has been saved" notification for something that did not exist. Now the farmer is told, what they typed
   stays, and nothing false is announced.
3. **The live account-deletion check no longer creates accounts on a project that confirms email**, where it
   would have emailed a test address and left an unconfirmed account behind.
4. **Documentation**: this file; [docs/play-store/LAUNCH_CHECKLIST.md](docs/play-store/LAUNCH_CHECKLIST.md);
   the security review updated with the settings the owner changed.

Earlier work this week (PRs #28 to #43) is summarised in [docs/play-store/README.md](docs/play-store/README.md)
and `git log`.

## 3. Tests run on 14 October 2026, and their results

| Check | Result |
| --- | --- |
| `npm run build` | Passes |
| `npm run test:unit` | 113 of 113 pass |
| `npm run test:e2e` (the real app in Chromium against an in-memory backend) | First run: 217 of 218. The one failure was an existing test that expected Supabase's old wording "Invalid login credentials", which this session replaced; the test was updated to the new wording and still checks the same behaviour. Re-run after the fix: see the line below |
| `npm test`, re-run on the final commit | Unit 113 of 113; end-to-end **218 of 218** |
| `npm run lint` | 31 problems (14 errors, 17 warnings): the same 31 that existed before this week's work. None is new |
| `npm audit` | 0 vulnerabilities |
| `npm run check:secrets` | No secret in the built app |
| `npm run check:repo` | 355 tracked files, no credentials or key files |
| `npm run test:security` (production database, inside a transaction that is rolled back) | 129 passed, 0 failed |
| `npm run test:clucky-live` (the deployed AI function) | 6 of 6, including a real answer and the refusal without consent |
| `npm run test:account-live` | 2 pass, 1 skipped on purpose: the full deletion check would need to create an account, which with email confirmation on sends an email. Deletion was proven end to end on 13 October, before confirmation was switched on |
| `npm run check:auth-urls` | 4 of 4 ok |
| `supabase db advisors --linked` | 28 warnings, 0 errors (was 64; the anonymous sign-in warnings are gone). The rest are accepted in `docs/play-store/security-audit.md`, findings 11 and 16 |

New tests added this session: `tests/unit/authMessages.test.js`, `tests/e2e/email-confirmation.test.js`
(sign-up and login with confirmation on, at 320, 360, 768 and 1280 px), `tests/e2e/save-failures.test.js`
(both of its tests fail on the code as it was before the fix).

**Not tested:** nothing has run on a real Android phone; no real confirmation or password-reset email was
sent, because that depends on the owner's email setup; layout of the changed screens was checked
automatically and by screenshot at 360 px in both themes, not on physical devices.

## 4. Remaining defects and limitations, by priority

**Critical**
1. Three real passwords (admin, vet, farmer) are in the public repository's history. They must be changed
   (section 5, step 1). The files are gone from `main` but the history was not rewritten.

**High**
2. **Email delivery is unconfirmed.** If Supabase still uses its built-in sender, only a few emails an hour
   go out, so most new email sign-ups and password resets will stall.
3. **Privacy Policy and Terms are not published**, and the operator name and contact email are empty. Google
   Play requires a published policy. (`src/config/legal.js`, `VITE_POLICIES_PUBLISHED`)
4. **No Android build, signing key, asset-links file or developer account.** Nothing has been submitted.

**Medium**
5. Phone sign-ups are not verified: anyone can register any phone number.
6. A farmer cannot block a vet in one-to-one messages (blocking covers the community and the marketplace).
7. The full live account-deletion check cannot run against production while email confirmation is on.

**Low**
8. 18 `alert()` pop-ups remain in older screens (admin approvals, gallery, marketplace, My Farm, profile).
   They do report errors; they are just not styled like the rest.
9. 31 lint problems in older files, mostly React's rule against setting state directly inside an effect.
10. Fonts load from Google Fonts, which costs a request to Google on every first visit.
11. `send-vaccine-reminder`, an early SMS function, is still deployed and holds an Africa's Talking key, but
    nothing in the app calls it (the app has in-app notifications only). Removing it is a production change
    for the owner to decide.

## 5. Owner actions, in order

The safest procedure for each is in [docs/play-store/LAUNCH_CHECKLIST.md](docs/play-store/LAUNCH_CHECKLIST.md).

1. **Change the three leaked passwords, admin first, and sign the admin out of all sessions** (checklist 0).
   Change them anywhere else they are used.
2. **Check email delivery** (checklist 1.6): Supabase > Authentication > Emails > SMTP. If no custom sender is
   set, add one (Resend, Brevo, Mailgun, SendGrid or similar), then sign up with an address of your own and
   confirm the email arrives. If emails cannot be made to arrive soon, the temporary fallback is to switch
   "Confirm email" off again: the app works either way, but finding 4 of the security review reopens.
3. **Merge the pull request for `fix/email-confirmation-signup`** if it is not already merged (it is safe:
   all checks above ran on it). Until it is merged, new email sign-ups see a false "Account created".
4. **Policies**: read `/privacy` and `/terms` (run the app locally with `VITE_POLICIES_PUBLISHED=true`), fill
   in `OPERATOR_LEGAL_NAME` and `CONTACT_EMAIL` in `src/config/legal.js`, then set `VITE_POLICIES_PUBLISHED=true`
   in Vercel (Production) and redeploy.
5. **Decide the Gemini plan** and make sure `/privacy` section 6 matches it; confirm the Supabase region.
6. **Decide the production domain and the Android application ID** (both effectively permanent).
7. **Create the Google Play developer account** (personal or organisation).
8. **Build and sign the Android app** on a machine with Java and the Android tools
   ([docs/play-store/android-release.md](docs/play-store/android-release.md)); keep the key store safe.
9. **Publish `/.well-known/assetlinks.json`** with the fingerprint from Play Console.
10. **Create and confirm reviewer accounts** for a farmer, a vet and a supplier.
11. **Fill in Play Console**: listing, Data safety, content rating, audience, ads, app access.
12. **Test on real phones**, then run the closed test (12 testers, 14 days) if the account is personal.
13. **Name who moderates** reports and requests, and how often
    ([docs/play-store/moderation-runbook.md](docs/play-store/moderation-runbook.md)).

## 6. Google Play launch blockers

Submission is blocked until all of these are true:

- [ ] Privacy Policy published at a public address, with the operator's name and a contact
- [ ] A signed Android App Bundle exists, targeting API level 36
- [ ] `assetlinks.json` published and verified
- [ ] Developer account created; Data safety, content rating, audience, ads and app access completed
- [ ] Reviewer accounts work (which needs email delivery, item 2 above)
- [ ] Tested on at least one real Android phone
- [ ] Closed test of 12 testers for 14 days done, if the developer account is personal

Already satisfied in the app: in-app and web account deletion, reporting and blocking, terms acceptance
before posting (switches on with the policies), consent before AI processing, no ads, no dangerous
permissions.

## 7. Commands and where things are

### Setup and development

```bash
npm ci                      # install exactly what package-lock.json says
npm run dev                 # local app at http://localhost:5173
```

### Checks

```bash
npm run build               # production build (run before every push to main)
npm run lint
npm test                    # unit + end-to-end, no database needed (about 10 minutes)
npm run check:secrets       # no secret in the built app
npm run check:repo          # no login or key file in the repository
npm audit
npm run test:security       # access rules against the linked database, rolled back
npm run test:clucky-live    # the deployed AI function (needs .env.test.local)
npm run test:account-live   # account functions (full deletion only runs with email confirmation off)
npm run check:auth-urls     # where sign-in returns people
npx supabase db advisors --linked
```

### Environment variables (names only)

| Where | Name | Needed for |
| --- | --- | --- |
| `.env` locally and Vercel (public by design) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Everything |
| Vercel | `VITE_POLICIES_PUBLISHED` | `true` publishes the policy pages and the terms agreement. Unset today, as far as the app shows |
| Supabase function secrets | `GEMINI_API_KEY` | Clucky (set) |
| Supabase function secrets, optional | `GEMINI_MODEL`, `CLUCKY_DAILY_LIMIT` (default 15), `CLUCKY_GLOBAL_DAILY_LIMIT`, `CLUCKY_ALLOWED_ORIGINS`, `ACCOUNT_ALLOWED_ORIGINS` | Tuning and a second fence (none set) |
| Supabase function secrets, legacy | `AFRICASTALKING_API_KEY` | Only `send-vaccine-reminder`, which the app does not call |
| Provided by Supabase itself | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Edge functions. Never put the service-role key anywhere else |
| `.env.test.local` (never committed) | `TEST_FARMER_EMAIL`, `TEST_FARMER_PASSWORD`, `TEST_SUPPLIER_EMAIL`, `TEST_SUPPLIER_PASSWORD` | Live tests |

Anything starting with `VITE_` is sent to every browser and must never hold a secret.

### Deploying

- **Web app**: merge a pull request into `main`; Vercel builds and deploys production. Work on a branch;
  let the Vercel check on the pull request pass before merging.
- **Database**: add a new file to `supabase/migrations/` (never edit an applied one), dry-run it inside a
  transaction that rolls back, then `npx supabase db push`. Run `npm run test:security` and the advisor after.
- **Edge functions**: `npx supabase functions deploy <name> --use-api`. Merging to `main` does **not** deploy
  them. Secrets: `npx supabase secrets set NAME=value`.

### Where things are

| Path | What |
| --- | --- |
| `CLAUDE.md` | Working rules, architecture notes and the mistakes already made once. Read before changing anything |
| `README.md` | What the app is and how to run it |
| `src/App.jsx` | Every route |
| `src/lib/` | Feature logic, unit tested (`authMessages.js`, `passwordRules.js`, `account.js`, `safety.js`, `clucky.js` ...) |
| `src/config/features.js`, `src/config/legal.js` | Feature switches; operator details for the policies |
| `supabase/migrations/`, `supabase/functions/`, `supabase/tests/security.sql` | Database history, edge functions, access-rule checks |
| `tests/unit/`, `tests/e2e/`, `tests/live/` | Tests |
| `docs/play-store/` | The Google Play pack; start at `README.md` and `LAUNCH_CHECKLIST.md` |
| `android/` | Settings for the Android wrapper. No key or build is kept here |

## 8. Risks, dependencies and rollback

**Risks**
- *Email.* With confirmation on and no working email service, new email users cannot finish signing up.
  Phone and Google sign-up still work.
- *Gemini free plan.* Shared by all farmers; when the day's allowance is used, Clucky politely refuses until
  the next day. The admin Clucky tab shows usage and the paid-plan cost.
- *Single owner of the keys.* The Supabase project, Vercel team, Google Cloud project and (soon) the Android
  signing key all sit with one person. Keep recovery codes and a backup of the key store.
- *Policy drift.* When a feature changes what is collected or shared, `/privacy`, `data-audit.md` and the
  Data safety answers must change in the same pull request.

**External dependencies**: Supabase (database, sign-in, storage, functions), Vercel (hosting), Google
(Gemini, Google sign-in, Google Fonts, Play), GitHub (code). No payment provider: nothing is sold in the app.

**Rollback**
- *A bad web deploy*: in Vercel > Deployments, use "Instant Rollback" on the project, or open the previous
  good production deployment and choose "Promote to Production". Then fix forward with `git revert -m 1 <merge commit>` on a branch and a pull
  request. Never force-push `main`.
- *A bad migration*: there are no down migrations. Write a new migration that undoes the change, dry-run it,
  push it. Data lost to a migration can only come from Supabase backups: check which backups your Supabase
  plan includes **before** relying on them.
- *A bad edge function*: `git checkout <good commit> -- supabase/functions/<name>`, then
  `npx supabase functions deploy <name> --use-api`.
- *Email confirmation causing sign-up trouble*: switch "Confirm email" off in Supabase; the app handles both
  states.
- *Clucky misbehaving*: remove or rotate `GEMINI_API_KEY`; the page then says Clucky is not switched on, and
  nothing else in the app is affected.

## 9. Plan for the next working session

1. Confirm with the owner that steps 1 to 3 of section 5 are done; if email is working, sign up with a real
   address on production and complete the whole path once (sign up, confirm, log in, reset password).
2. Once the operator details exist, publish the policies, then re-run `tests/e2e/account.test.js` and check
   `/privacy` and `/terms` signed out on a phone.
3. With the domain and application ID decided, generate the Android project, build, and run the device
   checklist in `android-release.md` on a low-end and a newer phone.
4. Publish `assetlinks.json`; verify with Google's checker.
5. Replace the remaining `alert()` pop-ups with the app's toast messages, one screen per commit.
6. Decide on phone verification (an SMS provider costs money) and on blocking in one-to-one messages.
7. Self-host the two fonts to drop the request to Google.
8. Work down the lint list, one file per commit, re-running `npm test` each time.
