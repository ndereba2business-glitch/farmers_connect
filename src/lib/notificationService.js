import { supabase } from "./supabaseClient";

// -----------------------------
// CREATE NOTIFICATION
// -----------------------------
export async function createNotification({
  title,
  message,
  type = "info"
}) {
  const { error } = await supabase
    .from("notifications")
    .insert([
      {
        title,
        message,
        type
      }
    ]);

  if (error) {
    console.error(error.message);
  }
}