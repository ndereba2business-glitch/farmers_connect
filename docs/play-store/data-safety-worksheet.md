# Data safety worksheet (Google Play)

A preparation sheet for the Data safety form in Play Console (App content > Data safety). Nothing here has
been submitted. Each answer is marked:

- **V** verified in the code or the database (see `data-audit.md`)
- **P** depends on a provider's current documentation: confirm before submitting
- **C** can only be decided or entered in Play Console, by the account owner

Google's definitions, read on 12 October 2026 from
<https://support.google.com/googleplay/android-developer/answer/10787469>:

- **Collected** = transmitted off the device by the app, its libraries or a web view it controls.
- **Shared** = transferred to a third party. Not counted as sharing: a *service provider* processing data
  only on your behalf; a transfer the user starts and expects; a transfer after prominent in-app disclosure
  and consent; fully anonymised data.

For a Trusted Web Activity the web app is the app, so everything the web app sends counts.

## Section 1: overview questions

| Question | Suggested answer | Mark | Why |
| --- | --- | --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** | V | Accounts, records, photos and messages are stored on servers |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | V | Every endpoint is HTTPS (Supabase, Vercel, Gemini). Google says to answer Yes only if this covers all data sent off-device, including by SDKs; there are none besides the Supabase client |
| Do you provide a way for users to request that their data is deleted? | **Yes** | V after deployment | In-app (Profile > Delete my account) and the web page `/delete-account` |
| Account deletion URL | `https://<production domain>/delete-account` | C | Enter the live address once deployed and checked in a signed-out browser |

## Section 2: data types

"Shared" below treats Supabase and Vercel as service providers (not sharing). **Google Gemini is the item
that needs a decision**: see the note after the table.

| Play category | Data type | Collected? | Shared? | Required or optional | Purposes | Mark | What it is in this app |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Personal info | Name | Yes | No | Required | App functionality, Account management | V | Account and profile name; vet and supplier names |
| Personal info | Email address | Yes | No | Optional (phone sign-up exists) | App functionality, Account management | V | Sign-in identity |
| Personal info | Phone number | Yes | No | Optional | App functionality, Account management | V | Sign-in identity for phone accounts; profile and listing contact numbers |
| Personal info | User IDs | Yes | No | Required | App functionality, Account management | V | Supabase user id |
| Personal info | Address | No | No | | | V | Only a county and an optional free-text location for suppliers. If you judge "location details" to be an address, change this to Yes / Optional |
| Personal info | Other info | Yes | No | Optional | App functionality | V | Vet licence number, farm name, bio |
| Location | Approximate / Precise location | **No** | No | | | V | No location permission and no geolocation call; county is typed text |
| Financial info | User payment info, Purchase history, Credit score | **No** | No | | | V | No payments. In-app ordering is switched off |
| Financial info | Other financial info | Yes | No | Optional | App functionality | V | The farmer's own expense, sale and profit records. Declare, because they are stored on the server |
| Health and fitness | Health info, Fitness info | **No** | No | | | V | Animal health records are not human health data |
| Messages | Emails, SMS or MMS | No | No | | | V | |
| Messages | Other in-app messages | Yes | **See note** | Optional | App functionality | V | Community messages, farmer-vet messages, questions to vets, questions to Clucky |
| Photos and videos | Photos | Yes | No | Optional | App functionality | V | Avatar, gallery, listing, community and question photos |
| Photos and videos | Videos | No | No | | | V | |
| Audio files | all | No | No | | | V | |
| Files and docs | Files and docs | Yes | No | Optional | App functionality | V | Lab result files uploaded by a vet |
| Calendar | Calendar events | No | No | | | V | Bookings are stored in the app, not read from the device calendar |
| Contacts | Contacts | No | No | | | V | |
| App activity | App interactions | Yes | No | Required | App functionality, Analytics | V | Contact events (a tap on Call or WhatsApp, counted per day) |
| App activity | In-app search history | No | No | | | V | Searches are not stored |
| App activity | Installed apps | No | No | | | V | |
| App activity | Other user-generated content | Yes | **See note** | Optional | App functionality | V | Flock records, listings, vet records, reports |
| App activity | Other actions | No | No | | | V | |
| Web browsing | Web browsing history | No | No | | | V | |
| App info and performance | Crash logs, Diagnostics, Other performance data | **No** | No | | | V | No crash or analytics SDK. Server logs are not app-collected diagnostics |
| Device or other IDs | Device or other IDs | **No** | No | | | V | No advertising ID or device identifier is read. Confirm the generated Android project adds none |

### The Gemini decision (rows marked "See note")

When a person asks Clucky, the question text (in-app message) and a farm summary (user-generated content)
are sent to Google's Gemini API.

- If Gemini acts as a **service provider** processing only on your instructions, this is not "sharing".
- If Google may use the content for its own purposes (improving its models, human review), it does not meet
  the service-provider definition. It can still fall under the exemption for a transfer made after
  **prominent in-app disclosure and consent**, which the app now has (the "Before you ask Clucky" screen).

What to do, in order:

1. **P** Read the current Gemini API terms for the plan your key is on.
2. If the plan forbids Google from using the content for its own purposes: answer "Shared: No".
3. Otherwise, the cautious answer is **"Shared: Yes"** for *Other in-app messages* and *Other user-generated
   content*, purpose *App functionality*. Declaring it is always acceptable; failing to declare is not.

**Recommendation: declare it as shared.** It costs nothing, and it stays true whichever plan you use.

Google's User Data policy also says its requirements "also apply to third-party AI integrations"
(<https://support.google.com/googleplay/android-developer/answer/10144311>). The disclosure, consent and
privacy-policy section for Clucky are how the app meets that.

## Section 3: per-data-type follow-up questions

For every type marked collected, the form asks:

- **Is this data processed ephemerally?** No. It is stored.
- **Is this data required, or can users choose?** As in the table.
- **Why is this data collected?** As in the table. Do not tick *Advertising or marketing*, *Personalization*
  or *Developer communications*: the app does none of them. *Analytics* applies only to contact events
  (counts shown to suppliers and admins); tick it for *App interactions* only.
- **Fraud prevention, security and compliance**: tick for *Name*, *Email*, *Phone* and *Other in-app
  messages* only if you want to reflect verification and moderation. Optional; it is accurate either way.

## Section 4: things to check before pressing Submit

1. **V** The privacy policy URL is live and public, and the Data safety answers agree with it.
2. **C** The deletion URL opens signed out and shows the request form.
3. **P** Supabase's encryption-at-rest statement and your plan's backup retention, if you describe them.
4. **P** The Gemini plan, as above.
5. **C** If you later add analytics, crash reporting, payments, push notifications or location, this form and
   the policy must change before that release.
6. **V** Confirm the Android project that Bubblewrap generates declares no permission beyond what a Trusted
   Web Activity needs (see `android-release.md`), because any SDK in the app counts.
