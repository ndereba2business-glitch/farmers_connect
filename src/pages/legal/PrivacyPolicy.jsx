import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout";
import { APP_NAME, CONTACT_EMAIL, MINIMUM_AGE, POSTAL_ADDRESS, PRIVACY_UPDATED, operatorName } from "../../config/legal";
import { DELETED_ITEMS, KEPT_ITEMS } from "../../lib/account";

// Every statement here describes what the code and the database actually
// do (see docs/play-store/data-audit.md for the evidence behind each one).
// If a feature changes what is collected or who receives it, change this
// page in the same pull request.
export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated={PRIVACY_UPDATED}>
      <p className="lg-lead">
        {APP_NAME} helps poultry farmers in Kenya keep flock records and reach vets, suppliers and other farmers.
        This policy says what information the app holds about you, why, who can see it, and how you can have it deleted.
      </p>

      <h2 id="who">1. Who is responsible</h2>
      <p>
        {APP_NAME} is run by {operatorName()} ("we"). We decide how the information below is used.
        {POSTAL_ADDRESS ? ` Our address is ${POSTAL_ADDRESS}.` : ""}
      </p>
      <p>
        To ask a privacy question, correct something, or ask for your data to be deleted, use the{" "}
        <Link to="/delete-account#request">request form</Link>
        {CONTACT_EMAIL ? <> or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></> : null}. We read every request.
      </p>

      <h2 id="collect">2. What we collect</h2>
      <p>We collect only what you type in, upload, or do in the app. We do not buy information about you from anyone.</p>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead>
            <tr><th scope="col">Information</th><th scope="col">Examples</th><th scope="col">Required?</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Account</td>
              <td>Your name, your email address or phone number, a password (stored only in scrambled form), and whether you are a farmer, vet or supplier. If you sign in with Google: the name, email address and profile photo Google gives us.</td>
              <td>Yes, to have an account</td>
            </tr>
            <tr>
              <td>Profile</td>
              <td>County, farm name, type and size of farm, a short description, a phone number, a profile photo</td>
              <td>Optional</td>
            </tr>
            <tr>
              <td>Farm records</td>
              <td>Batches, vaccinations, deaths, expenses, sales (including a buyer's name if you write one), tasks, feed calculations, gallery photos and captions</td>
              <td>Optional: only what you record</td>
            </tr>
            <tr>
              <td>Vet services</td>
              <td>Questions you ask a vet and any photo you attach, bookings, messages between you and a vet, and the visit reports, prescriptions and lab results a vet writes for you</td>
              <td>Only if you use Ask Vet</td>
            </tr>
            <tr>
              <td>Vet profile</td>
              <td>Name, photo, licence number, counties served, specialisms, fees, working days and hours</td>
              <td>Required to offer vet services</td>
            </tr>
            <tr>
              <td>Supplier profile and listings</td>
              <td>Business name, phone and WhatsApp numbers, county, location, opening hours, logo, description; and for each listing its name, price, photo, location and contact number</td>
              <td>Required to list products</td>
            </tr>
            <tr>
              <td>Community</td>
              <td>Messages, photos and reactions you post in the group, reports you send, and whether an admin has paused your posting</td>
              <td>Only if you take part</td>
            </tr>
            <tr>
              <td>Clucky (AI assistant)</td>
              <td>Your questions, Clucky's answers, and how many questions you asked each day</td>
              <td>Only if you use Clucky, and only after you agree</td>
            </tr>
            <tr>
              <td>Contacts you start</td>
              <td>That you tapped Call or WhatsApp on a listing or supplier, and on which day. The supplier is told a farmer got in touch, never who.</td>
              <td>Recorded when you tap</td>
            </tr>
            <tr>
              <td>Technical</td>
              <td>Your sign-in session, kept in your browser's storage. The companies that host the app keep ordinary server logs (such as IP address, time, browser type) for security and fault-finding.</td>
              <td>Yes, for the app to work</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>What we do not collect:</strong> your precise location (the app never asks for GPS; "county" is what you type),
        your contacts, your SMS or call history, payment card or M-Pesa details (no money moves through the app), or
        advertising identifiers. The app has no advertising and no analytics or tracking tools.
      </p>

      <h2 id="use">3. What we use it for</h2>
      <ul>
        <li>To run your account and show you your own records.</li>
        <li>To connect you with vets and suppliers when you ask for that.</li>
        <li>To send the in-app notifications you have switched on (there are no SMS or push notifications).</li>
        <li>To keep the community and marketplace safe: reviewing reports, removing content that breaks the rules, pausing accounts.</li>
        <li>To check that vets and suppliers are who they say they are before marking them "Verified".</li>
        <li>To find and fix faults.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h2 id="visible">4. Who can see what inside the app</h2>
      <ul>
        <li><strong>Only you:</strong> your farm records, tasks, finances, feed calculations, notifications and your conversation with Clucky.</li>
        <li><strong>You and the vet involved:</strong> your questions to that vet, bookings, messages, visit reports, prescriptions and lab results. Verified vets can see emergency questions so one of them can answer quickly, and can see farmers' profiles.</li>
        <li><strong>Everyone signed in:</strong> community messages with your name, your marketplace listings including the contact number you put on them, and the profiles of verified vets and suppliers.</li>
        <li><strong>Administrators:</strong> profiles, listings, community content and reports, in order to verify, moderate and support.</li>
        <li><strong>Nobody who is not signed in</strong> can read anything from the database.</li>
      </ul>
      <div className="lg-box">
        <p>
          <strong>Photos have unlisted public links.</strong> Profile photos, gallery photos, listing photos and community photos
          are stored so that anyone who has the exact web address of a photo can open it. The addresses are long and random and are
          only shown inside the app, but do not upload a photo you would not want seen. Lab result files are private to you and your vet.
        </p>
      </div>

      <h2 id="share">5. Who we share it with</h2>
      <p>We use a small number of companies to run the app. They receive information only to provide their service to us.</p>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead>
            <tr><th scope="col">Company</th><th scope="col">What it does</th><th scope="col">What it receives</th></tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>Stores the database and files, and handles sign-in</td><td>Everything in section 2</td></tr>
            <tr><td>Vercel</td><td>Delivers the app to your phone</td><td>Technical logs (IP address, browser type)</td></tr>
            <tr><td>Google (Gemini)</td><td>Writes Clucky's answers</td><td>See section 6</td></tr>
            <tr><td>Google (sign-in)</td><td>Only if you choose "Continue with Google"</td><td>Google learns that you signed in to {APP_NAME}</td></tr>
            <tr><td>Google (Fonts)</td><td>Supplies the typeface the app is drawn in</td><td>Your IP address, when the font is fetched</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        When you tap Call or WhatsApp, your phone opens its own dialler or WhatsApp. What happens there is between you, the other
        person and that service, not {APP_NAME}.
      </p>
      <p>We may also disclose information if a Kenyan law or a court requires it.</p>

      <h2 id="ai">6. Clucky and artificial intelligence</h2>
      <p>
        Clucky is an AI assistant. Its answers are written by Google's Gemini service, not by a person and not by a vet. Before
        your first question the app tells you this and asks you to agree. If you do not agree, nothing is sent and the rest of the
        app works as normal.
      </p>
      <p>When you ask Clucky something, we send Google:</p>
      <ul>
        <li>the question you typed, and the recent messages of that conversation so a follow-up makes sense;</li>
        <li>a short summary of your farm from your records: your county, your active batches (name, type of bird, number, age) and vaccinations marked overdue.</li>
      </ul>
      <p>
        We do <strong>not</strong> send your name, email address, phone number or farm name. Anything you type into the question
        yourself is sent as written, so do not put names, phone numbers or other private details in a question.
      </p>
      <p>
        Google processes this under its own terms for the Gemini service. Depending on the plan the service runs on, Google may keep
        the content for a limited time, use it to improve its products, and have it read by trained reviewers. We ask Google not to
        store the conversation on our behalf. Your conversation is also kept in our database so you can read it again; you can clear
        it at any time from the Clucky page.
      </p>

      <h2 id="storage">7. Where it is kept and how it is protected</h2>
      <ul>
        <li>Information travels between your phone and our servers over an encrypted connection (HTTPS).</li>
        <li>It is stored with Supabase, on servers that may be outside Kenya. Supabase encrypts stored data.</li>
        <li>Database rules decide, row by row, who may read or change anything, and we test them.</li>
        <li>Passwords are never stored in readable form, and no secret key is ever sent to your phone.</li>
      </ul>
      <p>No system is perfectly secure. If a breach affects you, we will tell you and the regulator as the law requires.</p>

      <h2 id="retention">8. How long we keep it</h2>
      <ul>
        <li>Your account and records: until you delete them or delete your account.</li>
        <li>A community message you remove: its text and photo are erased at once; an empty "removed" marker stays so replies still make sense.</li>
        <li>A listing you remove: deleted at once, with its photo.</li>
        <li>Requests sent through the request form: deleted within 90 days of being resolved.</li>
        <li>Hosting logs and backups held by our providers: removed on those providers' own schedules.</li>
      </ul>

      <h2 id="deletion">9. Deleting your account</h2>
      <p>
        You can delete your account yourself at any time: open <strong>Profile</strong> in the app (<strong>Account</strong> for suppliers) and choose
        {" "}<strong>Delete my account</strong>, or go to <Link to="/delete-account">the account deletion page</Link>. If you cannot
        sign in, the same page has a form to ask us to do it. Deletion is permanent and happens straight away. It is not a
        deactivation.
      </p>
      <h3>Deleted</h3>
      <ul>{DELETED_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>Kept, and why</h3>
      <ul>{KEPT_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>
      <p>
        Copies in our providers' backups and logs disappear on the schedules in section 8. If you only want particular records
        removed, you can delete batches, photos, listings, messages and your Clucky conversation one by one without closing your account.
      </p>

      <h2 id="rights">10. Your rights</h2>
      <p>Under Kenya's Data Protection Act, 2019 you have the right to:</p>
      <ul>
        <li>be told how your information is used (this policy);</li>
        <li>see the information we hold about you, most of which is visible in the app itself;</li>
        <li>have wrong information corrected (edit it in the app, or ask us);</li>
        <li>object to or restrict a use of it, including by switching notifications off or not using Clucky;</li>
        <li>have it deleted (section 9);</li>
        <li>complain to the Office of the Data Protection Commissioner (<a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">odpc.go.ke</a>).</li>
      </ul>
      <p>To use any of these, use the <Link to="/delete-account#request">request form</Link>. We answer as quickly as we can, and within the time the law allows.</p>

      <h2 id="children">11. Children</h2>
      <p>
        {APP_NAME} is for adults running or serving poultry farms. You must be {MINIMUM_AGE} or older to have an account. We do not
        knowingly collect information from children; if you believe a child has an account, tell us and we will remove it.
      </p>

      <h2 id="permissions">12. What the app asks of your phone</h2>
      <p>
        The app asks to use your camera or photo library only at the moment you choose to add a photo. It does not ask for your
        location, contacts, microphone, SMS or phone-call records, and it does not run in the background.
      </p>

      <h2 id="changes">13. Changes to this policy</h2>
      <p>
        If we change how your information is used, we will update this page and its date, and for an important change we will ask
        you in the app to read and accept it again.
      </p>
    </LegalLayout>
  );
}
