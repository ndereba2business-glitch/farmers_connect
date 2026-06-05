import { supabase } from "./supabaseClient";

export async function createNotification({ userEmail, type, title, message, link = null }) {
  const { error } = await supabase.from("notifications").insert([
    {
      user_email: userEmail,
      type,
      title,
      message,
      link,
      read: false,
    },
  ]);

  if (error) {
    console.error("Failed to create notification:", error.message);
  }
}