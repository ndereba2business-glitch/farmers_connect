# Google Play release pack

Everything prepared for taking Farmers Connect to Google Play, and an honest account of what is and is not
done. Written on 13 October 2026.

**Where things stand:** the web app is hardened and its policy-related features are built and tested. No
Android app has been built, no developer account exists as far as this repository knows, and nothing has
been submitted to Google. A passing web build is not Android readiness, and a review of code against
published policy is not Google's approval.

## Read in this order

| Document | What it is for |
| --- | --- |
| [security-audit.md](security-audit.md) | **Start here.** Findings by severity. Item 1 needs action today: three real passwords were in the public repository |
| [policy-matrix.md](policy-matrix.md) | Each Google Play policy, whether it applies, the evidence, and what is left |
| [data-audit.md](data-audit.md) | What the app holds about people, where it goes, how long it is kept. The evidence behind the next two |
| [data-safety-worksheet.md](data-safety-worksheet.md) | Suggested answers for Play Console's Data safety form, each marked verified, provider-dependent or console-only |
| [android-release.md](android-release.md) | How to build the Android app (Trusted Web Activity), signing, asset links, a device test list |
| [store-listing.md](store-listing.md) | Draft title and descriptions, graphics checklist, content rating facts, target audience, ads, permissions, reviewer accounts, testing track |
| [moderation-runbook.md](moderation-runbook.md) | Who has to look at reports and requests, how often, and what to do |
| [image-licences.md](image-licences.md) | Source and licence of every photograph on the landing page |

The policy documents themselves are pages of the app: `/privacy`, `/terms` and `/delete-account`
(`src/pages/legal/`). The first two are written but **not published** until the owner switches them on.

## What only the owner can do

In rough order. Details are in the document named.

1. **Change the three leaked passwords**, admin first (security-audit.md, finding 1).
2. **Read the Privacy Policy and the Terms**, ideally with someone qualified in Kenyan law, fill in the
   legal name and contact email in `src/config/legal.js`, then publish them by setting
   `VITE_POLICIES_PUBLISHED=true` in Vercel and redeploying (policy-matrix.md, sections 1 and 4).
3. **Set up an email service in Supabase and turn on email confirmation** (security-audit.md, findings 4
   and 5). Password reset emails depend on the same service.
4. **Decide the production address and the application ID** before any Android build
   (android-release.md). Both are effectively permanent.
5. **Create the Google Play developer account**, choosing personal or organisation (store-listing.md,
   section 9).
6. **Build, sign and test the Android app** on a machine with the tools (android-release.md).
7. **Publish the asset-links file** with the fingerprint Play Console gives you (android-release.md).
8. **Create reviewer accounts** for a farmer, a vet and a supplier (store-listing.md, section 8).
9. **Fill in Play Console**: store listing, Data safety, content rating, target audience, ads, app access.
10. **Run the closed test** if the account is a personal one: 12 testers for 14 days.
11. **Name the person who moderates**, and how often (moderation-runbook.md).
12. Smaller Supabase settings: Site URL, anonymous sign-ins off, allowed origins for the edge functions
    (security-audit.md, findings 10, 13, 15), and confirm the Supabase region and the Gemini plan
    (data-audit.md).

## Keeping this pack true

These documents describe the app as it is. When a feature changes what is collected, who receives it, or
what a member can post, change the policy page, `data-audit.md` and the worksheet in the same pull request.
The tests help: `tests/e2e/account.test.js`, `safety.test.js`, `landing.test.js` and
`supabase/tests/security.sql` fail when the behaviour these documents describe stops being true.
