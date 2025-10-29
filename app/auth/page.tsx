"use client";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthPage() {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="max-w-md mx-auto p-6 card">
      <h1 className="text-xl mb-4">Sign in</h1>
      {sent ? (
        <p className="text-slate-300">Check your email for a magic link.</p>
      ) : (
        <form onSubmit={sendLink} className="grid gap-3">
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn" type="submit">Send magic link</button>
          {err && <p className="text-red-400 text-sm">{err}</p>}
        </form>
      )}
    </div>
  );
}
