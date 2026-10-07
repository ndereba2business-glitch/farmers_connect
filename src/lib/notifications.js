import { supabase } from "./supabaseClient";

// Notifications for other people are created by the database when the
// event happens (see the notifications_system migration); the browser is
// only allowed to write to the signed-in person's own inbox. Use this for
// those: a confirmation of something the person just did themselves.
export async function createNotification({ userEmail, type, title, message, link = null }) {
  const { error } = await supabase.from("notifications").insert([
    { user_email: userEmail, type, title, message, link },
  ]);

  if (error) {
    console.error("Failed to create notification:", error.message);
  }
}
