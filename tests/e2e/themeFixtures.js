// Shared by the theme tests: an app with something on every screen (an
// empty page proves nothing about colours), the list of pages each role
// sees, and the function that measures contrast inside the browser.

const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export const THEME_USERS = {
  farmer: { email: "farmer@theme.test", role: "farmer" },
  vet: { email: "vet@theme.test", role: "vet" },
  supplier: { email: "supplier@theme.test", role: "supplier" },
  admin: { email: "admin@theme.test", role: "farmer", admin: true }
};

// The pages each role can reach from its menu, plus the signed-out ones.
export const PAGES = {
  farmer: ["/", "/my-farm", "/tasks", "/finance", "/feed-calculator", "/gallery", "/marketplace", "/bookings", "/community", "/clucky", "/profile"],
  vet: ["/vet", "/appointments", "/vet/farmers", "/vet-profile", "/community", "/profile"],
  supplier: ["/supplier", "/supplier/products", "/supplier/products/new", "/supplier-profile", "/marketplace", "/community", "/profile"],
  admin: ["/admin", "/verifications", "/marketplace", "/community"],
  visitor: ["/login", "/signup", "/delete-account", "/privacy", "/terms"]
};

export function seedEverything(backend) {
  const users = {};
  for (const [role, details] of Object.entries(THEME_USERS)) users[role] = backend.addUser(details);
  const farmer = THEME_USERS.farmer.email;
  const t = backend.db.tables;

  t.farm_batches = [
    { id: "b1", user_email: farmer, batch_name: "Broilers October", batch_type: "broiler", livestock_type: "broiler", quantity: 200, initial_count: 200, current_count: 194, mortality: 6, hatch_date: day(-18), start_date: day(-18), status: "active", created_at: ago(26000) },
    { id: "b2", user_email: farmer, batch_name: "Layers house 2", batch_type: "layer", livestock_type: "layer", quantity: 120, initial_count: 120, current_count: 118, mortality: 2, hatch_date: day(-150), start_date: day(-150), status: "active", created_at: ago(216000) }
  ];
  t.vaccination_tasks = [
    { id: "v1", batch_id: "b1", user_email: farmer, vaccine_name: "Gumboro (IBD)", day_number: 14, method: "Drinking water", scheduled_date: day(-4), completed: false, created_at: ago(26000) },
    { id: "v2", batch_id: "b1", user_email: farmer, vaccine_name: "Newcastle (Lasota)", day_number: 21, method: "Drinking water", scheduled_date: day(3), completed: false, created_at: ago(26000) },
    { id: "v3", batch_id: "b1", user_email: farmer, vaccine_name: "Newcastle + IB", day_number: 7, method: "Eye drop", scheduled_date: day(-11), completed: true, completed_date: day(-11), created_at: ago(26000) }
  ];
  t.mortality_logs = [{ id: "m1", batch_id: "b1", user_email: farmer, date: day(-2), count: 3, notes: "Found in the morning", created_at: ago(2900) }];
  t.batch_expenses = [{ id: "e1", batch_id: "b1", user_id: users.farmer.id, category: "feed", description: "Starter mash", amount: 9600, expense_date: day(-10), created_at: ago(14000) }];
  t.batch_sales = [{ id: "s1", batch_id: "b2", user_id: users.farmer.id, what_sold: "eggs", unit: "tray", quantity: 40, price_per_unit: 420, total_amount: 16800, sale_date: day(-1), created_at: ago(1500) }];
  t.farm_tasks = [
    { id: "t1", user_email: farmer, title: "Clean the drinkers", description: "Both houses", due_date: day(0), completed: false, priority: "high", category: "cleaning", created_at: ago(300) },
    { id: "t2", user_email: farmer, title: "Order layers mash", due_date: day(2), completed: false, priority: "medium", category: "feeding", created_at: ago(900) },
    { id: "t3", user_email: farmer, title: "Weigh a sample of broilers", due_date: day(-1), completed: true, priority: "low", category: "health", created_at: ago(2000) }
  ];
  t.farm_finances = [
    { id: "f1", user_email: farmer, batch_name: "Broilers October", expense_type: "Feed", amount: 9600, notes: "", created_at: ago(14000) },
    { id: "f2", user_email: farmer, batch_name: "Layers house 2", expense_type: "Medicine", amount: 1800, notes: "Dewormer", created_at: ago(4000) }
  ];
  t.feed_calculations = [{ id: "fc1", user_email: farmer, batch_id: "b1", batch_name: "Broilers October", chicken_type: "broiler", num_birds: 194, current_age: 18, target_age: 42, total_kg: 720, bags_50: 15, bags_70: 11, created_at: ago(600) }];
  t.farm_gallery = [];
  t.notifications = [
    { id: "n1", user_email: farmer, type: "vaccination", category: "vaccinations", title: "A vaccination is overdue", message: "Gumboro (IBD) for Broilers October was due 4 days ago.", read: false, link: "/my-farm", created_at: ago(60), cleared_at: null },
    { id: "n2", user_email: farmer, type: "community", category: "community", title: "Bob replied to you", message: "Try the growers mash from Unga.", read: true, link: "/community", created_at: ago(900), cleared_at: null }
  ];
  t.notification_preferences = [];
  t.community_chat = [
    { id: "c1", user_email: THEME_USERS.vet.email, user_name: "Dr. Achieng", message: "Remember: Gumboro vaccine at day 14 for broilers.", image_url: null, sender_badge: "vet", created_at: ago(200), reply_to_id: null, reply_to_user: null, reply_to_message: null, removed_at: null, removed_by: null },
    { id: "c2", user_email: farmer, user_name: "Test farmer", message: "Thanks. Which feed is everyone using for layers?", image_url: null, sender_badge: null, created_at: ago(120), reply_to_id: "c1", reply_to_user: "Dr. Achieng", reply_to_message: "Remember: Gumboro vaccine at day 14 for broilers.", removed_at: null, removed_by: null },
    { id: "c3", user_email: THEME_USERS.supplier.email, user_name: "Kiambu Feeds", message: "We have layers mash at 3,300 a bag this week.", image_url: null, sender_badge: "supplier", created_at: ago(60), reply_to_id: null, reply_to_user: null, reply_to_message: null, removed_at: null, removed_by: null },
    { id: "c4", user_email: THEME_USERS.admin.email, user_name: "Admin", message: "", image_url: null, sender_badge: "admin", created_at: ago(30), reply_to_id: null, reply_to_user: null, reply_to_message: null, removed_at: ago(20), removed_by: "author" }
  ];
  t.message_reactions = [{ id: "r1", message_id: "c1", user_email: farmer, user_name: "Test farmer", emoji: "👍" }];
  t.community_reports = [];
  t.community_mutes = [];
  t.content_reports = [{ id: "cr1", kind: "listing", target_id: "p9", target_summary: "Miracle powder, KES 200/item", reporter: farmer, reason: "Scam or misleading", status: "open", created_at: ago(50) }];
  t.account_requests = [{ id: "ar1", kind: "delete_account", identity: "wanjiru@example.com", message: "I lost my phone.", status: "open", created_at: ago(70) }];
  t.user_blocks = [];
  t.clucky_messages = [
    { id: "k1", user_email: farmer, role: "user", content: "How much should 3-week broilers eat?", created_at: ago(40) },
    { id: "k2", user_email: farmer, role: "assistant", content: "About 90 to 110 g a bird each day at three weeks.\n- Give broiler starter until day 21, then finisher\n- Keep water clean and always available", created_at: ago(39) }
  ];
  t.vet_questions = [
    { id: "q1", user_email: farmer, farmer_id: users.farmer.id, category: "Disease Symptoms", question: "Two birds are sneezing since yesterday.", image_url: null, status: "answered", is_emergency: false, answer: "Separate them and check the litter for damp. If more start, book a visit.", severity: "medium", created_at: ago(3000), responded_at: ago(2800) },
    { id: "q2", user_email: farmer, farmer_id: users.farmer.id, category: "Feeding", question: "Can I mix my own layers mash?", image_url: null, status: "pending", is_emergency: false, answer: null, severity: "low", created_at: ago(200) }
  ];
  t.vet_profiles = [{
    id: "vp1", user_id: users.vet.id, email: THEME_USERS.vet.email, full_name: "Dr. Achieng Odhiambo", bio: "Poultry vet, 8 years in Kiambu and Nairobi.", photo_url: null,
    service_counties: ["Kiambu", "Nairobi"], specializations: ["Broilers", "Layers"], accepts_emergency: true, available_now: true, base_fee: 1500,
    license_number: "KVB-0000", verification_status: "verified", working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"], available_start_time: "08:00", available_end_time: "17:00", created_at: ago(90000)
  }];
  t.vet_blocked_dates = [];
  t.vet_appointments = [
    { id: "a1", vet_email: THEME_USERS.vet.email, vet_id: users.vet.id, requested_vet_id: users.vet.id, farmer_email: farmer, farmer_id: users.farmer.id, farm_name: "Wanjiru Poultry", county: "Kiambu", bird_count: 200, appointment_date: day(2), appointment_time: "10:00", urgency: "normal", status: "pending", reason: "Sneezing in the broiler house", fee: 1500, source: "booking", created_at: ago(400) },
    { id: "a2", vet_email: THEME_USERS.vet.email, vet_id: users.vet.id, requested_vet_id: users.vet.id, farmer_email: farmer, farmer_id: users.farmer.id, farm_name: "Wanjiru Poultry", county: "Kiambu", bird_count: 120, appointment_date: day(-9), appointment_time: "14:00", urgency: "normal", status: "completed", reason: "Drop in laying", fee: 1500, source: "booking", created_at: ago(15000), completed_at: ago(12900) }
  ];
  t.visit_records = [];
  t.vet_medical_records = [];
  t.vet_farmer_messages = [];

  backend.db.supplier_profiles.push({
    id: "sp-theme", user_id: users.supplier.id, business_name: "Kiambu Feeds", verification_status: "verified", product_categories: ["feeds", "medicine"],
    county: "Kiambu", location_details: "Opposite the market", operating_hours: "Mon-Sat 8am-6pm", phone: "0712345678", whatsapp_number: "", description: "Feeds from local millers.", delivery_available: true, logo_url: null
  });
  const now = new Date().toISOString();
  const product = (extra) => ({
    unit: "per_bag", stock: 20, county: "Kiambu", seller_phone: "0712345678", description: "", image_url: "", availability: "in_stock", sold_out: false,
    is_active: true, is_verified: false, created_at: now.replace("Z", ""), updated_at: now, ...extra
  });
  backend.db.products.push(
    product({ id: "p1", product_name: "Layers mash 70kg", category: "feeds", price: 3300, price_max: 3500, supplier_name: "Kiambu Feeds", user_email: THEME_USERS.supplier.email, supplier_id: "sp-theme" }),
    product({ id: "p2", product_name: "Chick drinker 3L", category: "equipment", unit: "per_piece", price: 350, supplier_name: "Kiambu Feeds", user_email: THEME_USERS.supplier.email, supplier_id: "sp-theme", availability: "out_of_stock", sold_out: true }),
    product({ id: "p3", product_name: "Kienyeji cockerels", category: "chickens", unit: "per_bird", price: 900, supplier_name: "Test farmer", user_email: farmer, supplier_id: null })
  );
  return users;
}

// Runs inside the page. Returns every piece of visible text whose contrast
// against what is actually behind it is below WCAG AA: 4.5:1, or 3:1 for
// large text (24px, or 18.66px bold). Text over a photograph or a gradient
// cannot be judged from colours alone and is skipped; so are disabled
// controls, which the standard exempts.
export function auditContrast() {
  const parse = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(/[,/ ]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1
  });
  const luminance = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const hex = ({ r, g, b }) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");

  function background(el) {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;   // a picture or a gradient
      const colour = parse(style.backgroundColor);
      if (colour && colour.a > 0) {
        layers.push(colour);
        if (colour.a >= 1) break;
      }
    }
    let result = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (!result || result.a === 0) result = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  }

  const failures = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    const el = walker.currentNode.parentElement;
    if (!text || !el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest("[aria-hidden='true'], [disabled], [aria-disabled='true'], script, style, noscript, option")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.5) continue;
    let dimmed = false;
    for (let node = el.parentElement; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 0.9) dimmed = true;
    if (dimmed) continue;
    const fg = parse(style.color);
    const bg = background(el);
    if (!fg || !bg) continue;
    const ink = fg.a < 1 ? over(fg, bg) : fg;
    const a = luminance(ink);
    const b = luminance(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      failures.push({ text: text.slice(0, 40), fg: hex(ink), bg: hex(bg), ratio: ratio.toFixed(2) });
    }
  }
  return failures;
}
