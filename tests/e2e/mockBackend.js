// A small in-memory stand-in for the Supabase REST, auth and storage APIs,
// enough to drive the supplier dashboard and marketplace end to end in a
// browser without touching a real database. It applies the same ownership
// rules as the real row-level security policies (owners edit their own
// products; inactive products are hidden from everyone else), so the UI's
// handling of "not allowed" can be tested too. The real policies are
// tested separately against the live database: npm run test:security.

export const MOCK_SUPABASE_URL = "https://e2e.supabase.test";
export const MOCK_ANON_KEY = "e2e-anon-key";

// Must match TERMS_VERSION in src/config/legal.js, or every mocked account
// is asked to accept the terms again.
export const MOCK_TERMS_VERSION = "2026-10-12";

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const fakeJwt = (sub) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, role: "authenticated", exp: 9999999999 })}.sig`;

let seq = 0;
const newId = (prefix) => `${prefix}-${++seq}`;

export function createMockBackend() {
  const db = {
    users: new Map(),          // email -> { id, email, password, role }
    supplier_profiles: [],
    products: [],
    contact_events: [],
    writes: [],
    googleEnabled: false,      // what /auth/v1/settings reports
    confirmEmail: true,        // "Confirm email" in Supabase: a new email account waits for its link
    signups: [],               // what /auth/v1/signup received
    resends: [],               // what /auth/v1/resend received
    resendStatus: 200,
    // true: the database refuses to delete a product, as a constraint or a
    // dropped connection would. Lets a test see what the page does then.
    productDeleteFails: false,
    // Tables whose reads fail with a server error, as on a dropped connection.
    failingTables: new Set(),
    failingWrites: new Set(),  // tables whose inserts, updates and deletes fail
    // The delete-account function: "ok" really removes the account from
    // this mock; any other value is the problem code it reports instead.
    deleteAccount: { mode: "ok", calls: [] },
    // The public request form: true makes it fail as a dropped connection would.
    accountRequestFails: false,
    // Any other table a test wants to use, as { table_name: [rows] }
    // (an empty list is enough to switch it on). Rows with a user_email
    // can only be read, added or deleted by that user, like the
    // owner-only policies on the real tables.
    tables: {},
    // Tables everyone signed in can read, whoever wrote the row.
    shared: new Set(["community_chat", "message_reactions"]),
    // Whole words the community refuses, standing in for community_blocked_terms.
    blockedWords: ["betting", "bitcoin"],
    rpcCalls: [],               // { name, user } for every database function called
    // How the Clucky function behaves: "answer" streams `reply` back;
    // any other value is the problem code it reports instead
    // (not_configured, daily_limit, declined, busy, cut_off).
    clucky: { mode: "answer", reply: "Give them clean water and keep the brooder warm.", asked: [] }
  };

  // newUser: true means the account has not seen the onboarding tour yet.
  // role: null is an account with no chosen role, like one Google just created.
  // admin: true gives the account the app_metadata role the real project
  // sets from the dashboard; it can't be self-declared.
  // termsAccepted: false is an account from before the terms existed.
  // cluckyConsent: false is one that has not yet agreed to Clucky's AI processing.
  // confirmed: false is an email account whose confirmation link was never opened.
  function addUser({ email, password = "secret123", role = "farmer", newUser = false, admin = false, termsAccepted = true, cluckyConsent = true, confirmed = true }) {
    const user = {
      id: newId("user"), email, password, role, admin, confirmed, hasSeenOnboarding: !newUser, notificationsEnabled: true,
      termsAcceptedAt: termsAccepted ? "2026-10-12T08:00:00Z" : null, termsVersion: termsAccepted ? MOCK_TERMS_VERSION : null,
      cluckyConsentAt: cluckyConsent ? "2026-10-12T08:00:00Z" : null
    };
    db.users.set(email, user);
    return user;
  }

  function authUser(user) {
    return {
      id: user.id, aud: "authenticated", role: "authenticated", email: user.email, phone: "",
      app_metadata: user.admin ? { role: "admin" } : {}, user_metadata: user.role ? { role: user.role } : {}, created_at: "2026-09-01T00:00:00Z"
    };
  }

  function session(user) {
    return {
      access_token: fakeJwt(user.id), token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-" + user.id, user: authUser(user)
    };
  }

  const ownProfileIds = (user) => db.supplier_profiles.filter(p => p.user_id === user?.id).map(p => p.id);
  const ownsProduct = (user, p) => !!user && (p.user_email === user.email || ownProfileIds(user).includes(p.supplier_id));
  // products_admin_delete: an admin may take any listing down, and sees hidden ones
  const mayDeleteProduct = (user, p) => ownsProduct(user, p) || !!user?.admin;

  // PostgREST-style filters: ?col=eq.value, ?col=in.(a,b)
  function matches(row, params) {
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "columns", "on_conflict", "offset"].includes(key)) continue;
      const [op, ...rest] = raw.split(".");
      const value = rest.join(".");
      if (op === "eq" && String(row[key]) !== value) return false;
      if (op === "in" && !value.replace(/^\(|\)$/g, "").split(",").includes(String(row[key]))) return false;
      if (op === "is" && value === "null" && row[key] != null) return false;
      if (op === "lt" && !(String(row[key]) < value)) return false;
      if (op === "lte" && !(String(row[key]) <= value)) return false;
      if (op === "gt" && !(String(row[key]) > value)) return false;
      if (op === "gte" && !(String(row[key]) >= value)) return false;
    }
    return true;
  }

  function withSupplier(product) {
    const sp = db.supplier_profiles.find(s => s.id === product.supplier_id);
    return { ...product, supplier: sp && sp.verification_status === "verified" ? { business_name: sp.business_name, verification_status: sp.verification_status } : null };
  }

  // What Supabase puts after the "#" when it sends someone back from Google.
  function googleReturnHash(user) {
    const { access_token, refresh_token, expires_in, token_type } = session(user);
    return "#" + new URLSearchParams({ access_token, refresh_token, expires_in, token_type }).toString();
  }

  // Installs the mock for one browser context, signed in (or not) as `user`.
  // returningAs: the account Google just vouched for. Nothing is stored in
  // the browser yet; the app has to build the session from the address.
  async function attach(context, { signedInAs = null, returningAs = null } = {}) {
    let current = db.users.get(signedInAs || returningAs) || null;

    if (signedInAs && current) {
      await context.addInitScript(([key, value]) => localStorage.setItem(key, value),
        ["sb-e2e-auth-token", JSON.stringify(session(current))]);
    }

    await context.route(`${MOCK_SUPABASE_URL}/auth/v1/**`, async route => {
      const req = route.request();
      const url = new URL(req.url());
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "password") {
        const { email, password } = JSON.parse(req.postData() || "{}");
        const user = db.users.get(email);
        if (!user || user.password !== password) return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
        if (user.confirmed === false) return json(400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
        current = user;
        return json(200, session(user));
      }
      // Sign-up. With "Confirm email" on, Supabase answers with the user and no
      // session, and gives the same answer for an address that already has an
      // account, so nobody can find out who is a member.
      if (url.pathname.endsWith("/signup")) {
        const body = JSON.parse(req.postData() || "{}");
        db.signups.push({ ...body, url: req.url() });
        const existing = db.users.get(body.email);
        if (db.confirmEmail && body.email) {
          const user = existing || addUser({ email: body.email, password: body.password, role: body.data?.role || "farmer", newUser: true, confirmed: false });
          return json(200, { ...authUser(user), identities: existing ? [] : [{ provider: "email" }] });
        }
        if (existing) return json(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
        const user = addUser({ email: body.email, password: body.password, role: body.data?.role || "farmer", newUser: true });
        current = user;
        return json(200, session(user));
      }
      if (url.pathname.endsWith("/resend")) {
        db.resends.push(JSON.parse(req.postData() || "{}"));
        if (db.resendStatus === 429) return json(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" });
        return json(200, {});
      }
      if (url.pathname.endsWith("/logout")) { current = null; return route.fulfill({ status: 204, body: "" }); }
      if (url.pathname.endsWith("/settings")) return json(200, { external: { google: db.googleEnabled, email: true, phone: true } });
      if (url.pathname.endsWith("/user")) {
        if (!current) return json(401, { message: "not signed in" });
        if (req.method() === "PUT") {
          const { data, password } = JSON.parse(req.postData() || "{}");
          if (data?.role) current.role = data.role;
          // choosing a new password (the reset page)
          if (password) {
            if (password === current.password) return json(422, { code: "same_password", message: "New password should be different from the old password." });
            current.password = password;
          }
        }
        return json(200, authUser(current));
      }
      return json(200, {});
    });

    // The clucky edge function: newline-delimited events, as the real one sends.
    await context.route(`${MOCK_SUPABASE_URL}/functions/v1/clucky`, async route => {
      const req = route.request();
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors, body: "ok" });
      const problem = (status, code, extra = {}) =>
        route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify({ code, ...extra }) });
      if (!current) return problem(401, "not_signed_in");
      // nothing is sent to the AI service before the person has agreed
      if (!current.cluckyConsentAt) return problem(403, "consent_required");

      const { message } = JSON.parse(req.postData() || "{}");
      const { mode, reply } = db.clucky;
      db.clucky.asked.push({ user: current.email, message });
      if (mode === "not_configured") return problem(503, "not_configured");
      if (mode === "daily_limit") return problem(429, "daily_limit", { limit: 30 });
      // the allowance everyone shares is used up: refused before any stream
      if (mode === "service_limit") return problem(429, "service_limit");

      const events = [];
      if (mode === "declined") {
        events.push({ t: "delta", text: "I can't help" }, { t: "error", code: "declined" });
      } else if (mode === "busy" || mode === "failed") {
        events.push({ t: "error", code: mode });
      } else {
        // sent in pieces, with a hand-over first, to exercise the reader
        events.push({ t: "delta", text: "discarded draft" }, { t: "reset" });
        for (const word of reply.split(/(?<= )/)) events.push({ t: "delta", text: word });
        if (mode !== "cut_off") events.push({ t: "done", truncated: false });
        const store = db.tables.clucky_messages;
        if (store) {
          const at = Date.now();
          store.push({ id: newId("ck"), user_email: current.email, role: "user", content: message, created_at: new Date(at).toISOString() });
          store.push({ id: newId("ck"), user_email: current.email, role: "assistant", content: reply, created_at: new Date(at + 1).toISOString() });
        }
      }
      return route.fulfill({
        status: 200, headers: cors, contentType: "application/x-ndjson; charset=utf-8",
        body: events.map(e => JSON.stringify(e)).join("\n") + "\n"
      });
    });

    // The delete-account edge function: the typed word, then the password
    // (or an admin naming someone else), then everything of theirs goes.
    await context.route(`${MOCK_SUPABASE_URL}/functions/v1/delete-account`, async route => {
      const req = route.request();
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors, body: "ok" });
      const answer = (status, body) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
      if (!current) return answer(401, { code: "not_signed_in" });
      const input = JSON.parse(req.postData() || "{}");
      db.deleteAccount.calls.push({ user: current.email, target: input.target || null });
      if (db.deleteAccount.mode !== "ok") return answer(500, { code: db.deleteAccount.mode });

      let leaving = current;
      if (input.target) {
        if (!current.admin) return answer(403, { code: "not_allowed" });
        leaving = db.users.get(input.target);
        if (!leaving) return answer(404, { code: "not_found" });
      } else {
        if (current.admin) return answer(403, { code: "admin_account" });
        if (input.confirm !== "DELETE") return answer(400, { code: "confirm_required" });
        if (input.password !== current.password) return answer(401, { code: "wrong_password" });
      }
      db.users.delete(leaving.email);
      db.products = db.products.filter(p => p.user_email !== leaving.email);
      db.supplier_profiles = db.supplier_profiles.filter(p => p.user_id !== leaving.id);
      for (const name of Object.keys(db.tables)) {
        db.tables[name] = db.tables[name].filter(r => r.user_email !== leaving.email && r.reporter !== leaving.email);
      }
      for (const r of db.tables.account_requests || []) if (r.identity === leaving.email) r.status = "done";
      if (leaving === current) current = null;
      return answer(200, { ok: true });
    });

    // The public request form: one row for an admin to read, nothing else.
    await context.route(`${MOCK_SUPABASE_URL}/functions/v1/account-request`, async route => {
      const req = route.request();
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors, body: "ok" });
      if (db.accountRequestFails) return route.abort("failed");
      const input = JSON.parse(req.postData() || "{}");
      const identity = String(input.identity || "").trim().toLowerCase();
      if (!identity.includes("@") && identity.replace(/[^0-9]/g, "").length < 9) {
        return route.fulfill({ status: 400, headers: cors, contentType: "application/json", body: JSON.stringify({ code: "bad_identity" }) });
      }
      (db.tables.account_requests ||= []).push({
        id: newId("req"), kind: input.kind, identity, message: input.message || null, status: "open", created_at: new Date().toISOString()
      });
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await context.route(`${MOCK_SUPABASE_URL}/storage/v1/**`, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "ok" }) }));

    await context.route(`${MOCK_SUPABASE_URL}/rest/v1/**`, async route => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method();
      const table = url.pathname.split("/rest/v1/")[1];
      const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      const reply = (status, rows) => {
        if (wantsObject) {
          if (!rows.length) return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "no rows" }) });
          return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(rows[0]) });
        }
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(rows) });
      };
      const body = () => { const b = JSON.parse(req.postData() || "{}"); return Array.isArray(b) ? b : [b]; };
      const params = [...url.searchParams.entries()];

      if (method === "GET" && db.failingTables.has(table)) {
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "XX000", message: "server error" }) });
      }
      // a save that does not reach the database: a dropped connection, a refused rule
      if (method !== "GET" && db.failingWrites.has(table)) {
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "XX000", message: "server error" }) });
      }

      if (table === "rpc/community_remove_message") {
        const { p_message_id } = JSON.parse(req.postData() || "{}");
        const message = (db.tables.community_chat || []).find(m => m.id === p_message_id && !m.removed_at);
        if (!message) return route.fulfill({ status: 200, contentType: "application/json", body: "false" });
        const who = message.user_email === current?.email ? "author" : current?.admin ? "admin" : null;
        if (!who) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "only the author or an admin can remove a message" }) });
        Object.assign(message, { message: "", image_url: null, removed_at: new Date().toISOString(), removed_by: who });
        db.tables.message_reactions = (db.tables.message_reactions || []).filter(r => r.message_id !== message.id);
        for (const r of db.tables.community_reports || []) if (r.message_id === message.id && r.status === "open") r.status = "removed";
        return route.fulfill({ status: 200, contentType: "application/json", body: "true" });
      }

      if (table.startsWith("rpc/")) db.rpcCalls.push({ name: table.slice(4), user: current?.email });
      if (table.startsWith("rpc/")) {
        if (table === "rpc/clucky_usage_summary") {
          if (!current?.admin) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "Admins only" }) });
          return reply(200, db.cluckyUsage || []);
        }
        if (table === "rpc/supplier_contact_summary") {
          const mine = ownProfileIds(current);
          const byProduct = new Map();
          for (const e of db.contact_events.filter(e => mine.includes(e.supplier_id))) {
            const k = e.product_id || "";
            const s = byProduct.get(k) || { product_id: e.product_id, users: new Set(), wa: new Set(), call: new Set() };
            s.users.add(e.by); (e.channel === "whatsapp" ? s.wa : s.call).add(e.by);
            byProduct.set(k, s);
          }
          return reply(200, [...byProduct.values()].map(s => ({ product_id: s.product_id, farmers: s.users.size, whatsapp: s.wa.size, calls: s.call.size })));
        }
        return reply(200, []);
      }

      if (method !== "GET" && method !== "HEAD") db.writes.push({ method, table, search: url.search, user: current?.email });

      if (table === "farmer_profiles") {
        if (method === "PATCH" && current) {
          const [changes] = body();
          if ("has_seen_onboarding" in changes) current.hasSeenOnboarding = changes.has_seen_onboarding;
          if ("notifications_enabled" in changes) current.notificationsEnabled = changes.notifications_enabled;
          if ("terms_accepted_at" in changes) { current.termsAcceptedAt = changes.terms_accepted_at; current.termsVersion = changes.terms_version; }
          if ("clucky_consent_at" in changes) current.cluckyConsentAt = changes.clucky_consent_at;
          if ("theme_preference" in changes) current.themePreference = changes.theme_preference;
        }
        return reply(200, current ? [{ id: "fp-" + current.id, user_email: current.email, full_name: "Test " + (current.role || "farmer"), has_seen_onboarding: current.hasSeenOnboarding, notifications_enabled: current.notificationsEnabled, terms_accepted_at: current.termsAcceptedAt, terms_version: current.termsVersion, clucky_consent_at: current.cluckyConsentAt, theme_preference: current.themePreference ?? null }] : []);
      }

      if (table === "supplier_profiles") {
        if (method === "GET") {
          const visible = db.supplier_profiles.filter(p => p.user_id === current?.id || p.verification_status === "verified");
          return reply(200, visible.filter(p => matches(p, params)));
        }
        if (method === "POST") {
          const [row] = body();
          if (!current || row.user_id !== current.id) return reply(403, []);
          let existing = db.supplier_profiles.find(p => p.user_id === current.id);
          if (existing) Object.assign(existing, row, { verification_status: existing.verification_status });
          else { existing = { id: newId("sp"), verification_status: "pending", ...row }; existing.verification_status = "pending"; db.supplier_profiles.push(existing); }
          return reply(201, [existing]);
        }
      }

      if (table === "products") {
        if (method === "GET") {
          const visible = db.products.filter(p => p.is_active || ownsProduct(current, p) || current?.admin);
          const rows = visible.filter(p => matches(p, params));
          const embed = (url.searchParams.get("select") || "").includes("supplier:");
          return reply(200, embed ? rows.map(withSupplier) : rows);
        }
        if (method === "POST") {
          const inserted = [];
          for (const row of body()) {
            if (!current || row.user_email !== current.email) return reply(403, []);
            if (row.supplier_id && !ownProfileIds(current).includes(row.supplier_id)) return reply(403, []);
            const now = new Date().toISOString();
            const product = { id: newId("prod"), availability: "in_stock", is_active: true, sold_out: false, created_at: now.replace("Z", ""), updated_at: now, ...row };
            product.sold_out = product.availability === "out_of_stock";
            db.products.push(product);
            inserted.push(product);
          }
          return reply(201, inserted);
        }
        const targets = db.products.filter(p => matches(p, params) && ownsProduct(current, p));
        if (method === "PATCH") {
          const [changes] = body();
          for (const p of targets) {
            Object.assign(p, changes, { updated_at: new Date().toISOString() });
            p.sold_out = p.availability === "out_of_stock";
          }
          return reply(200, targets);
        }
        if (method === "DELETE") {
          if (db.productDeleteFails) {
            return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "23514", message: "violates check constraint" }) });
          }
          const gone = db.products.filter(p => matches(p, params) && mayDeleteProduct(current, p));
          db.products = db.products.filter(p => !gone.includes(p));
          return reply(200, gone);
        }
      }

      if (table === "contact_events" && method === "POST") {
        const [row] = body();
        const product = row.product_id ? db.products.find(p => p.id === row.product_id && p.is_active) : null;
        if (row.product_id && !product) return reply(400, []);
        db.contact_events.push({ ...row, supplier_id: product ? product.supplier_id : row.supplier_id, by: current?.id });
        return reply(201, []);
      }

      // The community group: what the insert guard and the unique rule on
      // reactions do in the real database.
      if (table === "community_chat" && method === "POST" && db.tables.community_chat) {
        const refuse = (code) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: code }) });
        const [row] = body();
        if (!current) return reply(401, []);
        const mute = (db.tables.community_mutes || []).find(m => m.user_email === current.email);
        if (mute && new Date(mute.muted_until) > new Date()) return refuse("community_muted");
        const text = (row.message || "").trim();
        if (!text && !row.image_url) return refuse("community_empty");
        if (db.blockedWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(text))) return refuse("community_blocked");
        const parent = row.reply_to_id ? db.tables.community_chat.find(m => m.id === row.reply_to_id && !m.removed_at) : null;
        const message = {
          id: newId("msg"), user_email: current.email, user_name: "Test " + (current.role || "farmer"),
          message: text, image_url: row.image_url || null,
          sender_badge: current.admin ? "admin" : null, created_at: new Date().toISOString(),
          reply_to_id: parent ? parent.id : null, reply_to_user: parent ? parent.user_name : null,
          reply_to_message: parent ? (parent.message || "Photo").slice(0, 140) : null,
          removed_at: null, removed_by: null
        };
        db.tables.community_chat.push(message);
        return reply(201, [message]);
      }

      if (db.tables[table]) {
        const shared = db.shared.has(table);
        const mine = (r) => shared || current?.admin
          || ("reporter" in r ? r.reporter === current?.email : !("user_email" in r) || r.user_email === current?.email);
        if (method === "GET") {
          let rows = db.tables[table].filter(mine).filter(r => matches(r, params));
          const order = url.searchParams.get("order");
          if (order) {
            const [column, direction] = order.split(".");
            rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (direction === "desc" ? -1 : 1));
          }
          const limit = Number(url.searchParams.get("limit"));
          if (limit) rows = rows.slice(0, limit);
          if (table === "community_reports" && (url.searchParams.get("select") || "").includes("message:")) {
            rows = rows.map(r => ({ ...r, message: (db.tables.community_chat || []).find(c => c.id === r.message_id) || null }));
          }
          if (table === "community_chat" && (url.searchParams.get("select") || "").includes("reactions:")) {
            rows = rows.map(m => ({ ...m, reactions: (db.tables.message_reactions || []).filter(r => r.message_id === m.id).map(r => ({ user_email: r.user_email, emoji: r.emoji })) }));
          }
          return reply(200, rows);
        }
        if (method === "POST") {
          const rows = body();
          // a member writes rows in their own name only; mutes are for admins
          if (rows.some(r => "user_email" in r && r.user_email !== current?.email && !current?.admin)) return reply(403, []);
          if (table === "community_mutes" && !current?.admin) return reply(403, []);
          // upsert: replace the row that matches the conflict columns
          const conflict = (url.searchParams.get("on_conflict") || "").split(",").filter(Boolean);
          const added = rows.map(r => {
            const existing = conflict.length ? db.tables[table].find(x => conflict.every(c => x[c] === r[c])) : null;
            if (existing) return Object.assign(existing, r);
            const created = { id: newId(table), created_at: new Date().toISOString(), ...r };
            db.tables[table].push(created);
            return created;
          });
          return reply(201, added);
        }
        if (method === "PATCH") {
          const [changes] = body();
          const targets = db.tables[table].filter(mine).filter(r => matches(r, params));
          for (const r of targets) Object.assign(r, changes);
          return reply(200, targets);
        }
        if (method === "DELETE") {
          const gone = db.tables[table].filter(mine).filter(r => matches(r, params));
          db.tables[table] = db.tables[table].filter(r => !gone.includes(r));
          return reply(200, gone);
        }
      }

      if (method === "GET" || method === "HEAD") return reply(200, []);
      return reply(201, []);
    });
  }

  return { db, addUser, attach, googleReturnHash };
}
