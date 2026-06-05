import { supabase } from "../lib/supabaseClient";

// SIGN UP
export async function signUp(email, password, role) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role }
    }
  });

  return { data, error };
}

// LOGIN
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return { data, error };
}

// LOGOUT
export async function signOut() {
  return await supabase.auth.signOut();
}