"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useState } from "react";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    // Sync cookies immediately so header updates without reload
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ event: "SIGNED_IN", session }),
      keepalive: true,
    });

    router.replace("/dashboard");
    // ensure server components re-render with fresh cookies
    router.refresh();
  }

  return (
    <div className="card max-w-md">
      <h1>Sign in</h1>
      <form className="mt-4 grid gap-3" onSubmit={signInWithPassword}>
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Sign in</button>
      </form>
    </div>
  );
}
