# Moderation runbook

Farmers Connect lets members post for each other to see: the community group, marketplace listings, profiles
and photos. Google Play requires that such an app is actually moderated, and it treats "apps that
continually fail to address user complaints" as a violation. The tools exist. This page is the part no tool
can do: who looks, how often, and what they do.

**Someone with an admin account must do this.** If nobody does, the app does not meet the policy however
good the tools are.

## Where things arrive

| What | Where to look | Sent by |
| --- | --- | --- |
| Reports about community messages | Admin > Community | "Report to admins" on a message |
| Reports about listings, Clucky answers and members | Admin > Requests > Reports | "Report this listing", "Report this answer", "Report [name]" |
| Account deletion and privacy requests | Admin > Requests > Account requests | The form on `/delete-account` |
| Vets and suppliers waiting for verification | Admin > Vets, Admin > Suppliers | Their profile pages |

There are no email or SMS alerts for admins. The tabs show counts; someone has to open them.

## How often

| Task | Suggested rhythm |
| --- | --- |
| Reports of any kind | Once a day. Anything involving a scam, a threat, a child or unsafe medicine the same day |
| Account deletion requests | Within 2 working days. Tell the person when it is done |
| Verification requests | Within 2 working days |
| A read through recent community messages | Twice a week, even with no reports |

These are suggestions, not commitments the app makes to users. If you publish a promise, keep it.

## What you can do

| Situation | Action | Where |
| --- | --- | --- |
| A message breaks the rules | Remove it. Its text and photo are erased; an empty marker stays | Tap the message in the community > Remove message (admin) |
| A member keeps breaking the rules | Stop them posting for 24 hours or 7 days. They are notified | Tap one of their messages |
| A word or phrase keeps appearing | Add it to the blocked words. Messages containing it are refused when sent | Admin > Community |
| A listing is a scam, illegal or unsafe | Remove it. The seller is notified automatically | Admin > Requests > Remove the listing, or Admin > Products |
| A vet or supplier misbehaves | Suspend their verification. They disappear from the directory | Admin > Vets / Suppliers |
| A report is wrong or malicious | Dismiss it | Admin > Requests |
| A report about a Clucky answer | Read the answer. If it is dangerous, note the question and tell whoever maintains the prompt (`supabase/functions/clucky/prompt.ts`). Then mark it dealt with | Admin > Requests |
| An account must go entirely | See "Deleting someone's account" below | |

There is no "ban account" button. Pausing posting and suspending verification cover most cases. To remove a
person altogether, delete the account; note that they can sign up again with another address.

## Deleting someone's account at their request

A request from the public form is **not proof of identity**: anyone can type any email address into it.

1. Contact the person on the email address or phone number in the request. Ask them to confirm, in their
   reply, that they want the account deleted.
2. Only when they have replied from that address or number: Admin > Requests > Delete this account.
3. The account, its records, listings, messages and photos are deleted at once. This cannot be undone.
4. Reply to tell them it is done.
5. If they do not reply, close the request with "Close, no action".

If the person can sign in, point them to Profile > Delete my account instead: it needs no admin.

Admin accounts cannot be deleted from the app. They are removed in the Supabase dashboard by the owner.

## When to go further than the app

- **A threat to someone's safety, or a child at risk:** contact the police. Do not rely on removing a
  message.
- **A suspected outbreak** reported in the community (many birds dying): the county veterinary office should
  hear about it. Clucky tells farmers this; an admin who sees it can say so too.
- **Counterfeit or prescription-only medicines offered for sale:** remove the listing, and consider telling
  the Veterinary Medicines Directorate.
- **A request from the police or a court for information about a member:** this is a legal matter. Take
  advice before answering.

## Records

Reports keep who reported, why, and how it was closed. The deletion log (`account_deletions`) keeps the date
and counts, never who. Do not keep your own private copies of members' messages or contact details outside
the app.

## What is not covered yet

- A farmer cannot block a vet inside farmer-vet messages. Blocking hides community messages and listings.
- Photos are not scanned automatically. A photo that breaks the rules is found by a report or by reading.
- Admins get no alert when a report arrives. They have to look.
