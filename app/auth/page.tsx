"use client";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useState } from "react";

export default function AuthPage() {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: (process.env.APP_URL || 'http://localhost:3000') + '/dashboard' } });
    if (error) alert(error.message);
    else setSent(true);
  };

  return (
    <div className="max-w-md mx-auto card">
      <h1>Sign in</h1>
      <p className="text-slate-300 mt-2">Use magic link via email.</p>
      <input className="input mt-6" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
      <button className="btn mt-3" onClick={signIn}>Send magic link</button>
      {sent && <p className="mt-3 text-green-400">Check your email for a link!</p>}
    </div>
  );
}
