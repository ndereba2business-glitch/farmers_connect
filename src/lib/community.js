// Helpers for the community group chat (src/pages/Community.jsx). Kept
// free of React and Supabase so they can be unit tested.

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

export const MESSAGE_MAX_LENGTH = 2000;

export const GROUP_RULES = [
  "This group is for poultry farming: chickens, feed, health, housing, eggs, markets and prices.",
  "Be respectful. No insults, and no attacking people for asking simple questions.",
  "No betting, loan apps, forex, crypto or other schemes, and no adult content.",
  "Selling something? Poultry products and services only, and list them in the Marketplace too.",
  "See something that doesn't belong? Tap the message and choose Report. Admins review every report."
];

// The server refuses some messages with a short code (see the
// community_chat_guard trigger). Turn each into words a farmer can act on.
export function sendErrorMessage(error) {
  const text = error?.message || "";
  if (text.includes("community_blocked")) {
    return "That message can't be posted here. This group is for poultry farming only, and insults or adverts for betting, loans and similar are not allowed.";
  }
  if (text.includes("community_too_fast")) return "You're sending messages very fast. Wait a minute, then try again.";
  if (text.includes("community_muted")) return "An admin has paused your posting in this group for now.";
  if (text.includes("community_empty")) return "Type a message or add a photo first.";
  if (text.includes("community_chat_message_length")) return `That message is too long. Keep it under ${MESSAGE_MAX_LENGTH} characters.`;
  return "Your message didn't send. Check your connection and try again; it's still in the box.";
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "Today", "Yesterday", or a date, the way chat apps label days.
export function dayLabel(value, now = new Date()) {
  const date = new Date(value);
  if (sameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric", month: "short", ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" })
  });
}

export function timeLabel(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Turns the message list (oldest first) into what the screen draws:
// a day heading whenever the date changes, and `showSender` only on the
// first of a run of messages from the same person, like a group chat.
export function buildTimeline(messages, now = new Date()) {
  const items = [];
  let previous = null;
  for (const message of messages) {
    const date = new Date(message.created_at);
    const newDay = !previous || !sameDay(new Date(previous.created_at), date);
    if (newDay) items.push({ kind: "day", key: `day-${message.id}`, label: dayLabel(date, now) });
    const showSender = newDay || previous.user_email !== message.user_email || Boolean(previous.removed_at);
    items.push({ kind: "message", key: message.id, message, showSender });
    previous = message;
  }
  return items;
}

// Reactions for one message, as [{ emoji, count, mine }], most used first.
// Each person has at most one reaction per message (enforced in the
// database), so `mine` is true for at most one entry.
export function summariseReactions(reactions, myIdentity) {
  const byEmoji = new Map();
  for (const r of reactions || []) {
    const entry = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.user_email === myIdentity) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

// What my reaction list looks like after I tap an emoji: tapping my
// current one removes it, tapping another replaces it.
export function applyMyReaction(reactions, myIdentity, emoji) {
  const others = (reactions || []).filter(r => r.user_email !== myIdentity);
  const current = (reactions || []).find(r => r.user_email === myIdentity);
  if (current?.emoji === emoji) return { reactions: others, action: "remove" };
  return { reactions: [...others, { user_email: myIdentity, emoji }], action: "set" };
}

const NAME_COLOURS = ["#b45309", "#0f766e", "#1d4ed8", "#7e22ce", "#be185d", "#15803d", "#c2410c", "#4338ca"];

// A steady colour per member for their name, as group chats do.
export function nameColour(identity) {
  let hash = 0;
  for (const ch of String(identity || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLOURS[hash % NAME_COLOURS.length];
}

export function removedText(message, myIdentity) {
  if (message.removed_by === "admin") return "This message was removed by an admin.";
  return message.user_email === myIdentity ? "You deleted this message." : "This message was deleted.";
}

export const BADGE_LABELS = { admin: "Admin", vet: "Vet", supplier: "Supplier" };
