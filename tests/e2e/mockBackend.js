// A small in-memory stand-in for the Supabase REST, auth and storage APIs,
// enough to drive the supplier dashboard and marketplace end to end in a
// browser without touching a real database. It applies the same ownership
// rules as the real row-level security policies (owners edit their own
// products; inactive products are hidden from everyone else), so the UI's
// handling of "not allowed" can be tested too. The real policies are
// tested separately against the live database: npm run test:security.

export const MOCK_SUPABASE_URL = "https://e2e.supabase.test";
export const MOCK_ANON_KEY = "e2e-anon-key";

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
    // Any other table a test wants to use, as { table_name: [rows] }
    // (an empty list is enough to switch it on). Rows with a user_email
    // can only be read, added or deleted by that user, like the
    // owner-only policies on the real tables.
    tables: {},
    // Tables everyone signed in can read, whoever wrote the row.
    shared: new Set(["community_chat", "message_reactions"]),
    // Whole words the community refuses, standing in for community_blocked_terms.
    blockedWords: ["betting", "bitcoin"]
  };

  // newUser: true means the account has not seen the onboarding tour yet.
  // role: null is an account with no chosen role, like one Google just created.
  // admin: true gives the account the app_metadata role the real project
  // sets from the dashboard; it can't be self-declared.
  function addUser({ email, password = "secret123", role = "farmer", newUser = false, admin = false }) {
    const user = { id: newId("user"), email, password, role, admin, hasSeenOnboarding: !newUser };
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

  // Installs the mock for one browser context, signed in (or not) as `user`.
  async function attach(context, { signedInAs = null } = {}) {
    let current = signedInAs ? db.users.get(signedInAs) : null;

    if (current) {
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
        current = user;
        return json(200, session(user));
      }
      if (url.pathname.endsWith("/logout")) { current = null; return route.fulfill({ status: 204, body: "" }); }
      if (url.pathname.endsWith("/settings")) return json(200, { external: { google: db.googleEnabled, email: true, phone: true } });
      if (url.pathname.endsWith("/user")) {
        if (!current) return json(401, { message: "not signed in" });
        if (req.method() === "PUT") {
          const { data } = JSON.parse(req.postData() || "{}");
          if (data?.role) current.role = data.role;
        }
        return json(200, authUser(current));
      }
      return json(200, {});
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

      if (table.startsWith("rpc/")) {
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
        }
        return reply(200, current ? [{ id: "fp-" + current.id, user_email: current.email, full_name: "Test " + (current.role || "farmer"), has_seen_onboarding: current.hasSeenOnboarding }] : []);
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
          const visible = db.products.filter(p => p.is_active || ownsProduct(current, p));
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
          db.products = db.products.filter(p => !targets.includes(p));
          return reply(200, targets);
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

  return { db, addUser, attach };
}
