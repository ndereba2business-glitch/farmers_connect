// The guided tour shown on first sign-in (and from "Replay Tour" on the
// profile page), one per role. Each step describes a screen that role
// really has in its menu; keep them in step with Layout.jsx and
// supplier/SupplierShell.jsx when menus change.
import {
  Egg, Calculator, CheckSquare, Stethoscope, ShoppingBag, Image, Bot,
  Users, Bell, UserCircle, ClipboardList, CalendarClock, LayoutDashboard,
  Package, Store, PhoneCall
} from "lucide-react";

const FARMER = {
  welcome: "Your complete poultry farming companion. This quick guide shows you how to get the most out of the app. It takes about 2 minutes.",
  closing: "You now know the key features of Farmers Connect. Start by adding your first batch of birds and the app will guide you from there. You can replay this tour any time from your profile.",
  cta: { label: "Go to My Farm", path: "/my-farm" },
  steps: [
    {
      icon: Egg, color: "#16a34a",
      title: "My Farm: track your batches",
      body: "Start by adding your batch of chicks. Tell the app how many birds you have, their type (broiler, layer, kienyeji) and when they hatched. Record deaths, sales and expenses as they happen.",
      tip: "✅ The app creates a vaccination schedule for each batch automatically."
    },
    {
      icon: Calculator, color: "#ea580c",
      title: "Feed Calculator: buy the right amount",
      body: "Enter your bird type, number and age to see how much feed they need each day, which feed to use at each stage, and how many bags to budget for.",
      tip: "💡 Feed is the biggest cost in poultry. Getting it right protects your profit."
    },
    {
      icon: CheckSquare, color: "#2563eb",
      title: "Tasks: stay organised",
      body: 'Add jobs like "Clean the coop", "Buy feed" or "Vaccinate birds". Tick them off when done so nothing is forgotten.',
      tip: "📋 Set a due date and priority so you always know what is urgent."
    },
    {
      icon: Stethoscope, color: "#dc2626",
      title: "Ask Vet: get expert help",
      body: "If your birds look sick or you have a question, ask a verified vet, book a farm visit, and follow the vet's reply and visit reports in one place.",
      tip: "🚨 Use the Emergency button when birds are dying fast."
    },
    {
      icon: ShoppingBag, color: "#9333ea",
      title: "Marketplace: buy and sell",
      body: "Find feed, chicks, medicine and equipment from verified suppliers near you, and contact them directly by phone or WhatsApp. You can also list your own birds and eggs for sale.",
      tip: "📸 Listings with clear photos get more calls."
    },
    {
      icon: Image, color: "#0d9488",
      title: "Gallery: your farm in pictures",
      body: "Take photos of your birds regularly to follow their growth, spot health problems early and keep a record you can show a vet or a buyer.",
      tip: "📷 Tag photos with the batch so they are easy to find later."
    },
    {
      icon: Bot, color: "#6366f1",
      title: "Clucky AI: your poultry assistant",
      body: "Ask Clucky any poultry question: disease signs, feeding, vaccination, egg production or costs. It knows about your own batches, so its advice fits your farm.",
      tip: '🤖 Try: "Why are my layers laying fewer eggs?"'
    },
    {
      icon: Users, color: "#ea580c",
      title: "Community: learn from other farmers",
      body: "A group chat for poultry farmers. Ask questions, share photos and tips, reply to others and react to messages. Keep it about poultry so it stays useful for everyone.",
      tip: "🌍 Introduce yourself and say what birds you keep."
    },
    {
      icon: Bell, color: "#db2777",
      title: "Notifications: never miss a date",
      body: "The bell at the top shows vaccination reminders, vet replies and other updates. You choose which alerts you want from your profile.",
      tip: "🔔 A red dot on the bell means something new is waiting."
    },
    {
      icon: UserCircle, color: "#0891b2",
      title: "Profile: your farm identity",
      body: "Add your name, farm name, county and a photo so vets, suppliers and other farmers know who they are dealing with.",
      tip: "📸 A complete profile builds trust."
    }
  ]
};

const VET = {
  welcome: "Welcome, Doctor. Farmers Connect links you with poultry farmers who need a vet. This quick guide shows you how your side of the app works.",
  closing: "That's everything. Start by completing your vet profile so an admin can verify you and farmers can find you. You can replay this tour any time from your profile.",
  cta: { label: "Set up my vet profile", path: "/vet-profile" },
  steps: [
    {
      icon: ClipboardList, color: "#16a34a",
      title: "My Vet Profile: get verified",
      body: "Fill in your licence number, the counties you serve, your specialisations, consultation fee and working days and hours. An admin reviews it, and once verified you appear to farmers.",
      tip: "✅ Farmers only see verified vets, so do this first."
    },
    {
      icon: Stethoscope, color: "#dc2626",
      title: "Vet Dashboard: your day at a glance",
      body: "See upcoming appointments, emergency requests from farmers and your recent activity. Answer farmers' questions here and turn a question into a farm visit when it needs one.",
      tip: "🚨 Emergency requests are shown first."
    },
    {
      icon: CalendarClock, color: "#2563eb",
      title: "Appointments: manage visit requests",
      body: "Accept or decline booking requests, pick up unassigned requests in your area, and write a visit report when the visit is done.",
      tip: "📅 Block the days you are away in your vet profile so farmers can't book them."
    },
    {
      icon: Users, color: "#9333ea",
      title: "My Farmers: records and messages",
      body: "Every farmer you have helped is listed here with their history. Message them, and keep medical records and prescriptions for their flocks.",
      tip: "🗂️ Good records make the next visit faster."
    },
    {
      icon: Users, color: "#ea580c",
      title: "Community: share your expertise",
      body: "Join the farmers' group chat. Answering common questions there builds your reputation and brings you clients.",
      tip: "🌍 Keep advice practical and about poultry."
    },
    {
      icon: Bell, color: "#db2777",
      title: "Notifications: new requests",
      body: "The bell at the top tells you when a farmer asks a question, books a visit or sends a message. Choose which alerts you want from your profile.",
      tip: "🔔 Quick replies earn better reviews."
    }
  ]
};

const SUPPLIER = {
  welcome: "Welcome to Farmers Connect. This is where poultry farmers find suppliers like you. This quick guide shows you how to get your products in front of them.",
  closing: "You're ready. Start by completing your supplier profile, then add your first product. You can replay this tour any time from the Account page.",
  cta: { label: "Set up my supplier profile", path: "/supplier-profile" },
  steps: [
    {
      icon: Store, color: "#16a34a",
      title: "Supplier profile: get verified",
      body: "Add your business name, county, phone and WhatsApp number, what you sell and your opening hours. An admin reviews it, and verified suppliers get a badge farmers trust.",
      tip: "✅ Farmers contact you on the phone and WhatsApp numbers you enter here."
    },
    {
      icon: Package, color: "#2563eb",
      title: "Products: list what you sell",
      body: "Add each product with a photo, price or price range, unit, minimum order and whether it is in stock. Edit, hide or delete a listing at any time.",
      tip: "📸 Listings with a clear photo and an up-to-date price get more calls."
    },
    {
      icon: PhoneCall, color: "#9333ea",
      title: "How farmers reach you",
      body: "There is no in-app checkout. A farmer taps Call or WhatsApp on your product and contacts you directly, with the product details already in the message.",
      tip: "💬 Reply quickly. Farmers usually contact more than one supplier."
    },
    {
      icon: LayoutDashboard, color: "#ea580c",
      title: "Dashboard: see what is working",
      body: "Your dashboard shows how many farmers contacted you in the last 30 days, which products they asked about, and listings that need updating.",
      tip: "📊 Mark items out of stock instead of leaving old listings up."
    },
    {
      icon: ShoppingBag, color: "#0d9488",
      title: "Marketplace: see what farmers see",
      body: "Open the marketplace to check how your listings look next to other suppliers, and what prices are being offered.",
      tip: "👀 Search for your own product to see it as a farmer would."
    },
    {
      icon: Users, color: "#ea580c",
      title: "Community: talk with farmers",
      body: "Join the farmers' group chat. Answer questions about feed, chicks and equipment, and say when you have stock. Verified suppliers show a Supplier badge next to their name.",
      tip: "🌍 Helpful answers bring more customers than adverts. Keep it about poultry."
    },
    {
      icon: UserCircle, color: "#0891b2",
      title: "Account: your personal details",
      body: "Your own name, photo and notification choices live under Account, separate from your business profile.",
      tip: "🔔 The bell at the top shows new updates."
    }
  ]
};

const TOURS = { farmer: FARMER, vet: VET, supplier: SUPPLIER };

// Admins manage the platform and don't get a tour.
export function tourFor(role) {
  return TOURS[role] || null;
}
