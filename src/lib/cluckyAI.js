// Clucky AI memory utilities

import { supabase } from "./supabaseClient";

// SAVE / UPDATE MEMORY
export async function saveCluckyMemory({
  email,
  farm_notes,
  disease_history,
  livestock_type
}) {
  const { data } = await supabase
    .from("clucky_memory")
    .select("*")
    .eq("user_email", email)
    .single();

  if (!data) {
    await supabase.from("clucky_memory").insert([
      {
        user_email: email,
        farm_notes,
        disease_history,
        livestock_type
      }
    ]);
  } else {
    await supabase
      .from("clucky_memory")
      .update({
        farm_notes,
        disease_history,
        livestock_type,
        last_update: new Date()
      })
      .eq("user_email", email);
  }
}

// RETRIEVE MEMORY (THIS IS WHAT YOU ASKED)
export async function getCluckyMemory(email) {
  const { data } = await supabase
    .from("clucky_memory")
    .select("*")
    .eq("user_email", email)
    .single();

  return data;
}