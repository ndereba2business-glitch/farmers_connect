import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);

  async function fetchWallet() {
    const user = await supabase.auth.getUser();

    const email = user.data.user.email;

    const { data } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_email", email)
      .single();

    setWallet(data);
  }

  useEffect(() => {
    fetchWallet();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>My Wallet</h1>

      {!wallet ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>
            Balance: KES {wallet.balance}
          </h2>

          <p>Role: {wallet.role}</p>
        </>
      )}
    </div>
  );
}