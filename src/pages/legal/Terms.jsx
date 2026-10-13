import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout";
import { APP_NAME, CONTACT_EMAIL, MINIMUM_AGE, PROHIBITED, TERMS_UPDATED, operatorName } from "../../config/legal";

export default function Terms() {
  return (
    <LegalLayout title="Terms and Community Rules" updated={TERMS_UPDATED}>
      <p className="lg-lead">
        These are the rules for using {APP_NAME}. They are written to be read. By creating an account or continuing to use the
        app you agree to them and to the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2 id="service">1. What {APP_NAME} is</h2>
      <p>
        {APP_NAME} is run by {operatorName()}. It is a tool for poultry farmers, vets and suppliers in Kenya: flock records, a way
        to reach vets, a marketplace where sellers list products, a community group, and an AI assistant called Clucky.
      </p>
      <p>
        We provide the place where people find each other. We are not the vet, the seller or the buyer, and we are not a party to
        anything you agree with another member.
      </p>

      <h2 id="account">2. Your account</h2>
      <ul>
        <li>You must be {MINIMUM_AGE} or older.</li>
        <li>Give true information, and choose the role (farmer, vet or supplier) that is really yours.</li>
        <li>Keep your password to yourself. You are responsible for what is done with your account.</li>
        <li>One person, one account. Do not create an account to get round a pause or removal.</li>
        <li>You can delete your account at any time: see <Link to="/delete-account">Delete your account</Link>.</li>
      </ul>

      <h2 id="rules">3. Community rules</h2>
      <p>
        The community group, marketplace listings, profiles and photos are seen by other members. Keep them about poultry farming,
        honest and respectful. The following are not allowed anywhere in the app:
      </p>
      <ul>{PROHIBITED.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <p>You are responsible for what you post, and you must have the right to post it, including any photo.</p>

      <h2 id="moderation">4. Reporting, blocking and what we do about it</h2>
      <ul>
        <li><strong>Report.</strong> Tap a community message and choose Report; use "Report this listing" on a marketplace listing; use "Report this answer" under an answer from Clucky. Reports go to our administrators and are not shown to the person reported.</li>
        <li><strong>Block.</strong> Tap a member's community message and choose Block. You will stop seeing their messages and listings. They are not told. You can unblock them from your Profile.</li>
        <li><strong>What we do.</strong> Administrators review reports. We may remove a message or listing, pause a member's posting, withdraw a "Verified" badge, or close an account, depending on how serious it is and whether it is repeated. Some words are refused automatically when a message is sent.</li>
        <li><strong>If it happens to you.</strong> You are notified when an administrator removes your listing or pauses your posting. If you think we got it wrong, tell us through the <Link to="/delete-account#request">request form</Link>{CONTACT_EMAIL ? <> or at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></> : null}.</li>
      </ul>
      <p>If someone is in danger or a crime is being committed, contact the police or other emergency services first.</p>

      <h2 id="marketplace">5. Marketplace</h2>
      <ul>
        <li>Listings are written by the sellers. We do not inspect products, hold stock, set prices or handle payment or delivery.</li>
        <li>You contact a seller by phone or WhatsApp and agree everything directly with them. No money moves through {APP_NAME}.</li>
        <li>"Verified" on a supplier means our team reviewed and approved the supplier's profile. It is not a guarantee of their products, prices or service.</li>
        <li>Sellers must describe products truthfully, keep prices and availability up to date, and follow the law, including the rules on veterinary medicines.</li>
        <li>Buyers should check goods before paying. Be careful with any seller who asks for payment before you have seen the product.</li>
      </ul>

      <h2 id="vets">6. Vets</h2>
      <ul>
        <li>A vet shown as "Verified" has had their profile and licence number reviewed and approved by our team. The vet, not {APP_NAME}, is responsible for their professional advice and treatment.</li>
        <li>An answer in the app is based on what you describe. It does not replace a vet examining your birds.</li>
        <li>In an emergency, such as many birds dying or falling ill quickly, use the Emergency button or call a vet directly. Do not wait for a written answer.</li>
        <li>Fees and visits are agreed between you and the vet.</li>
      </ul>

      <h2 id="clucky">7. Clucky, the AI assistant</h2>
      <div className="lg-box lg-box--warn">
        <p>
          <strong>Clucky is a computer program, not a vet.</strong> It can be wrong, including about numbers, medicines and
          diseases. Use it for general guidance, check anything important with a vet or the product label, and never delay
          getting a vet for sick or dying birds because of something Clucky said.
        </p>
      </div>
      <ul>
        <li>Clucky's answers are generated by an outside AI service. What is sent to it is described in the <Link to="/privacy#ai">Privacy Policy</Link>.</li>
        <li>Clucky does not diagnose, does not give medicine doses, and does not recommend particular sellers.</li>
        <li>There is a daily limit on questions. Do not try to misuse Clucky or make it produce harmful content.</li>
        <li>If an answer is wrong, harmful or offensive, report it with "Report this answer".</li>
      </ul>

      <h2 id="content">8. Your content</h2>
      <p>
        What you write and upload stays yours. You allow us to store it and show it inside {APP_NAME} to the people described in
        the Privacy Policy, so the app can work. That permission ends when you delete the content or your account, except for the
        few items the Privacy Policy says are kept.
      </p>

      <h2 id="liability">9. What we promise, and what we cannot</h2>
      <ul>
        <li>We work to keep the app available and your records safe, but it is provided as it is. It needs an internet connection and can be unavailable at times.</li>
        <li>Feed amounts, vaccination reminders and other figures in the app are guides. Follow your hatchery, your vet and the product label where they differ.</li>
        <li>You decide how to run your farm. To the extent the law allows, we are not responsible for losses that follow from advice, listings or actions of other members, vets, suppliers or Clucky.</li>
      </ul>
      <p>Nothing in these terms takes away rights that Kenyan law gives you and that cannot be signed away.</p>

      <h2 id="ending">10. Ending</h2>
      <p>
        You can stop using the app and delete your account whenever you like. We can pause or close an account that breaks these
        rules, puts other members at risk, or is used unlawfully.
      </p>

      <h2 id="changes">11. Changes and the law that applies</h2>
      <p>
        If we change these terms in a way that matters, we will ask you in the app to accept the new version. These terms are
        governed by the laws of Kenya.
      </p>
    </LegalLayout>
  );
}
