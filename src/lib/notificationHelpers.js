// What the notification bell and settings screen need that isn't a
// database call. No imports, so it can be unit tested on its own.

// The switches on the notification settings screen. `key` is the column
// in notification_preferences; the database decides which switch each
// notification type belongs to (notification_category()).
export const NOTIFICATION_CATEGORIES = [
  {
    key: "vaccinations", label: "Vaccination reminders",
    detail: "Vaccines due tomorrow, due today and overdue.", roles: ["farmer"]
  },
  {
    key: "farm", label: "Farm tasks and records",
    detail: "Tasks due or overdue, and confirmations when you save records.", roles: ["farmer"]
  },
  {
    key: "vet", label: "Vet visits and answers",
    detail: {
      farmer: "A vet answers your question, accepts or declines a visit, or sends a message.",
      vet: "New visit requests, cancellations, messages from farmers and visit reminders."
    },
    roles: ["farmer", "vet"]
  },
  {
    key: "marketplace", label: "Marketplace",
    detail: {
      farmer: "Updates about your listings and requests.",
      supplier: "A farmer contacts you about a product, and order requests."
    },
    roles: ["farmer", "supplier"]
  },
  {
    key: "community", label: "Community",
    detail: "Someone replies or reacts to your message in the group.", roles: ["farmer", "vet", "supplier", "admin"]
  },
  {
    key: "clucky", label: "Clucky AI",
    detail: "Clucky has finished answering your question.", roles: ["farmer"]
  }
];

export function categoriesFor(role) {
  return NOTIFICATION_CATEGORIES
    .filter(c => c.roles.includes(role))
    .map(c => ({ key: c.key, label: c.label, detail: typeof c.detail === "string" ? c.detail : c.detail[role] }));
}

const CATEGORY_COLOURS = {
  vaccinations: "#dc2626",
  farm: "#d97706",
  vet: "#2563eb",
  community: "#7c3aed",
  marketplace: "#059669",
  clucky: "#4f46e5",
  account: "#475569"
};

export function categoryColour(category) {
  return CATEGORY_COLOURS[category] || CATEGORY_COLOURS.account;
}

// "just now", "5 min ago", "3 h ago", "yesterday", then a date.
export function timeAgo(value, now = new Date()) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 172800) return "yesterday";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// The unread badge: nothing at zero, capped so it stays one or two characters.
export function badgeText(unread) {
  if (!unread || unread < 1) return "";
  return unread > 9 ? "9+" : String(unread);
}
