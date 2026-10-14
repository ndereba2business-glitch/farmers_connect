# Security review, 12 to 13 October 2026

A focused review of sign-in, access control, files, secrets, dependencies and abuse controls, done before
packaging the app for Google Play. Findings are ranked by how easily they could be exploited and what an
attacker would gain, not by how alarming they sound.

**Status words:** *Fixed* means changed and covered by a test that ran. *Owner* means only the owner can do
it. *Accepted* means left as it is, with the reason.

Checks referred to as `H18`, `D3` and so on are in `supabase/tests/security.sql` (`npm run test:security`),
which runs against the live database inside a transaction that is always rolled back.

## Summary

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Real passwords, including the admin's, in the public repository | **Critical** | Files removed; **Owner must change three passwords** |
| 2 | Anyone on the internet could list every uploaded photograph | **High** | Fixed |
| 3 | "Delete Account" did not delete the account or most of its data | **High** | Fixed |
| 4 | Email addresses are not confirmed at sign-up | **High** | Email: switched on by the owner (seen 14 Oct); app updated for it. **Owner** to confirm an email service is set up. Phone: still not confirmed |
| 5 | No way to recover a forgotten password | Medium | Fixed for email accounts; phone accounts: **Owner** |
| 6 | A new account could inherit a previous account's profile | Medium | Fixed |
| 7 | Questions and farm details went to an AI service with no notice or consent | Medium | Fixed |
| 8 | Vulnerable dependencies (8 advisories, 6 high) | Medium | Fixed: 0 remain |
| 9 | Lab-result uploads had no size or type limit | Low | Fixed |
| 10 | Anonymous sign-ins were enabled in Supabase | Low | Fixed by the owner (seen off on 14 Oct) |
| 11 | Leaked-password protection is off | Low | **Owner** (needs a paid Supabase plan) |
| 12 | A deleted account's token works for up to an hour | Low | Accepted |
| 13 | Edge functions accept requests from any website | Low | **Owner** (one setting), otherwise accepted |
| 14 | Photographs are reachable by anyone who has their exact address | Low | Accepted and disclosed |
| 15 | Supabase's Site URL pointed at a team-only address | Low | Fixed by the owner (`check:auth-urls` all ok on 14 Oct) |
| 16 | 18 tables have overlapping access rules | Info | Accepted (performance only) |

## 1. Real passwords in the public repository: Critical

**What.** `.tmp-test/`, a folder of throwaway browser scripts committed in `f6dcfe0`, contained the email
address and password of the **admin account** (`test3_admin_verify.cjs`) and of a vet and a farmer account
(`test1_login.cjs`). The repository is public on GitHub.

**Exploitability.** Trivial: read the file, sign in. The admin account can verify vets and suppliers, remove
listings and messages, pause members, read deletion requests and delete other people's accounts.

**Done.** PR #39 removed the folder, ignored it, and added `npm run check:repo`, which fails if a login, an
API key, a private key or a key store is tracked. The rest of the history was searched: nothing else real
was found.

**Not done, and it is the part that matters.** The passwords are still in the git history and may already
have been copied. **Change all three passwords, the admin's first, and change them anywhere else they are
used.** Then sign the admin user out of all sessions in Supabase (Authentication > Users). Until that is
done, treat the admin account as compromised.

Nobody working on this review signed in with those accounts.

## 2. Anyone could list every uploaded photograph: High

**What.** The four photo buckets each had a read rule on `storage.objects` granted to `public`, which
includes visitors who are not signed in. A request carrying only the app's public key, which is in every
copy of the app, was given the list of files.

**Proof.** Before the fix, an unauthenticated request listed 8 gallery files, 5 avatars, 5 listing photos
and 1 community photo. The app treats gallery photos as private to their owner.

**Fixed.** PR #40, migration `20261013120000`: a signed-in person lists only their own folder; a visitor lists
nothing. Showing a photo by its address is unchanged. After the fix the same request returns 0 entries for
every bucket, and an existing photo still loads. Checks `H19`, `H20`.

## 3. "Delete Account" did not delete: High

**What.** The button removed rows from 3 of about 30 tables and signed the person out. The login kept
working and most of what they had written stayed. This is also a direct breach of Google Play's account
deletion policy.

**Fixed.** PR #35: `delete_account_data()` removes everything the account owns in one transaction, then the
files, then the login. It asks for the typed word and the password (or a sign-in within ten minutes for
Google accounts); an admin account cannot delete itself; a non-admin cannot name another account. Checks
`D0` to `D9`, and `npm run test:account-live`, which proved it end to end on a throwaway account.

## 4. Email addresses are not confirmed: High, Owner

**What.** Supabase reports `mailer_autoconfirm: true` and `phone_autoconfirm: true`: a new account is active
at once, without proving the email address or phone number is the person's own.

**Why it matters.** Identity in this app *is* the email or phone number. Someone can register another
person's address, appear under it in the community and the marketplace, and block the real owner from
signing up. A vet or supplier profile could be requested in someone else's name; admin verification is
then the only check.

**What to do.** In Supabase > Authentication > Sign In / Providers, turn on "Confirm email". Before you
do, set up an email service (Authentication > Emails > SMTP): Supabase's built-in sender is limited to a
few messages an hour and is meant for testing only, so with it switched on real farmers would not receive
their confirmation emails. Phone confirmation needs an SMS provider and costs money per message; decide
whether phone sign-up is worth keeping without it.

**Not changed in code**, because switching confirmation on without working email would lock new users out.

**Update, 14 October 2026.** The owner switched "Confirm email" on (`/auth/v1/settings` now reports
`mailer_autoconfirm: false`). The app was not ready for it: sign-up said "Account created successfully!" and
moved the person into the app with no session. Fixed on branch `fix/email-confirmation-signup`: sign-up now
says to open the link and can send it again, login explains an unconfirmed address
(`tests/e2e/email-confirmation.test.js`). Still for the owner: **whether an email service (SMTP) is set up
cannot be seen from outside.** If it is not, check Authentication > Emails > SMTP before more people sign
up: the built-in sender allows only a few emails an hour, and every new email account now depends on one.
Phone sign-ups are still accepted without proof (`phone_autoconfirm: true`).

## 5. No password recovery: Medium

**What.** There was no "forgot password" anywhere. A farmer who forgot theirs had lost the account.

**Fixed for email accounts.** PR #40: `/forgot-password` sends a link; `/reset-password` sets a new password of at
least 8 characters. The form gives the same answer whether or not the address has an account. Tested in
`tests/e2e/password-reset.test.js`.

**Owner.** (a) The same email service as in finding 4: without it, reset emails are throttled to a handful
an hour. (b) Add `https://<production domain>/**` to Supabase's Redirect URLs so the link returns to the
reset page; if it is missing the app still routes the person there, but from the Site URL. (c) Phone-only
accounts cannot reset by text message until an SMS provider is configured; the page tells them to use the
request form, which reaches an admin.

## 6. A new account could inherit an old profile: Medium

**What.** Profiles are keyed by email or phone. If an account was ever removed in the Supabase dashboard,
its profile row stayed, and the next sign-up with that address was handed it: the previous person's name,
phone number and county. Two such leftover profiles exist in the live database today. Combined with
finding 4, the next person need not be the same one.

**Fixed.** The sign-up trigger now clears any leftover profile first (check `H18`), and accounts deleted
through the app leave nothing behind. **Always delete accounts through the app or Admin > Requests, not the
Supabase dashboard**: the dashboard removes the login but not the rows keyed by email.

**Owner, optional.** The two leftover profiles hold a name and possibly a phone number for accounts that no
longer exist. To remove them, run in the SQL editor:

```sql
delete from public.farmer_profiles f
 where not exists (select 1 from auth.users u where coalesce(nullif(u.email, ''), u.phone) = f.user_email);
```

It was not run for you because it deletes production data.

## 7. AI processing without notice: Medium

**Fixed.** PR #35 and #36: Clucky asks before the first question, says what is sent to Google and what is
not, and the edge function refuses with `consent_required` until the agreement is saved. No name, email or
phone number is sent. Verified live.

## 8. Vulnerable dependencies: Medium

**What.** `npm audit` reported 8 advisories, 6 of them high. The one in shipped code was `react-router`
(a denial of service through route matching, and a bypass that applies only to a server mode this app does
not use). The rest were build-time tools.

**Fixed.** `npm audit fix` updated within the existing version ranges (react-router-dom 7.18.4, vite 8.1.3
and transitive packages). 0 advisories remain. The full test suite was re-run on the updated versions:
unit 107 of 107, end-to-end 208 of 208.

## 9. Lab-result uploads unlimited: Low

**Fixed.** The `lab-results` bucket now accepts PDF or an image up to 10 MB, and the form says so before
uploading. Only verified vets could upload, into their own folder, so the exposure was a vet filling
storage or uploading something inappropriate.

## 10 and 11. Two Supabase settings: Low, Owner

- **Anonymous sign-ins are enabled.** The database refuses anonymous sessions on every table (a restrictive
  rule, check `H11` to `H14`), so nothing is exposed, but the setting serves no purpose and produces 36
  of the advisor's 64 warnings (it reports no errors). Turn it off in Authentication > Sign In / Providers.
  **Done by the owner:** `/auth/v1/settings` reported `anonymous_users: false` on 14 October 2026.
- **Leaked-password protection is off.** It checks new passwords against known breaches. It is a paid-plan
  feature; turn it on if you move to one.

## 12. A deleted account's token lives up to an hour: Low, Accepted

Supabase access tokens are valid for an hour and cannot be recalled. After deletion there is nothing left
to read, but a second device still signed in could write a new row in that hour. Such a row would belong to
no account and be visible to nobody else. Shortening token life would sign everyone out more often on slow
connections, which is the wrong trade for this audience.

## 13. Edge functions accept any origin: Low

`clucky` and `delete-account` answer browsers on any website (`Access-Control-Allow-Origin: *`) unless the
function secret `CLUCKY_ALLOWED_ORIGINS` (or `ACCOUNT_ALLOWED_ORIGINS`) is set. They are protected by the
person's sign-in token, not by the origin, so another site cannot use them without that token.
**Owner:** once the production domain is settled, run
`supabase secrets set CLUCKY_ALLOWED_ORIGINS=https://<production domain>` as a second fence.
`account-request` is public by design and limited per address and per hour.

## 14. Photographs are public by address: Low, Accepted

Buckets are public so that images load quickly without a signed request per photo. Anyone with the exact
address of a photograph can open it; addresses are long, random and shown only inside the app. Listing is
now closed (finding 2). The privacy policy says this plainly. Lab-result files are private.

## 15. Supabase's Site URL: Low

Recorded by the session that fixed Google sign-in: the Site URL is a team-scoped Vercel address;
`vercel.json` forwards it to the public one and the public address is now on the Redirect URLs list.
`npm run check:auth-urls` reports the state. **Done by the owner:** on 14 October 2026 `check:auth-urls`
reported all four checks ok, including the Site URL. Keep `vercel.json`'s forward as a safety net.

## 16. Overlapping access rules: Info

Supabase's advisor lists 18 "multiple permissive policies" warnings. They mean two rules are evaluated
where one combined rule would do: a small cost per query, not a security problem. Left alone: merging them
risks changing who can see what, for no user-visible gain at this size.

The advisor's 9 "signed-in users can execute a SECURITY DEFINER function" warnings are intended: those are
the functions the app calls, and each checks who is calling (`admin_contact_stats`, `clucky_usage_summary`
and others return only to admins; checks `F7`, `K` series).

## What was reviewed and found sound

| Area | What was checked |
| --- | --- |
| Roles | `admin` comes only from `app_metadata`, which no account can set for itself; a self-declared admin is treated as a farmer in the app and refused by the database (checks `L2`, `C` series) |
| Row-level security | Enabled on every table, with the anonymous-session rule; visitors have no table access (`H14`, `A1` to `A6`) |
| Other people's data | Editing, deleting or reading another member's products, records, messages, reports and blocks is refused (`S`, `F`, `N`, `C`, `R`, `B` series) |
| Privileged actions | Verification, moderation, listing removal and account deletion are enforced in the database or an edge function, not only hidden in the interface |
| Secrets | The Gemini key and the service-role key exist only as function secrets; the built app is scanned for them (`npm run check:secrets`), and now the source too (`npm run check:repo`) |
| AI cost and abuse | A daily limit per account kept in a table only the function can write, a question length limit, a shared-allowance pause |
| Input and output | No `dangerouslySetInnerHTML`, `eval` or user-controlled script. Product, supplier and message fields have database constraints. Uploads are limited by type and size in the bucket and resized in the browser |
| Logging | Edge functions log codes and sizes, never the question, the answer, an email address or a key |
| Redirects | `?next=` on the login page accepts only a path on this site |

## How to re-run the checks

```bash
npm run check:repo        # no credentials or key files in the repository
npm run check:secrets     # no secret in the built app
npm audit                 # dependency advisories
npm run test:security     # access rules, against the live database, rolled back
supabase db advisors --linked
npm run check:auth-urls   # where sign-in returns people
npm run test:account-live # account deletion, on a throwaway account
```
