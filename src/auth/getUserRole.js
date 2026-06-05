import { supabase } from "../lib/supabaseClient";

export async function getUserRole() {
  const { data } = await supabase.auth.getUser();

  return data?.user?.user_metadata?.role;
}