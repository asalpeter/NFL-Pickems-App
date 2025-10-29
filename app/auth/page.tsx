"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Already signed in? Continue flow.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) router.replace("/auth/callback");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) router.replace("/auth/callback");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is OFF in Supabase, you'll get a session immediately.
        // If it's ON, redirect to callback anyway; the session may be null until confirmed.
        router.replace("/auth/callback");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 card">
      <h1 className="text-xl mb-4">Welcome</h1>

      <div className="flex gap-2 mb-4">
        <button
          className={`btn ${mode === "signin" ? "bg-slate-800" : ""}`}
          onClick={() => setMode("signin")}
          type="button"
        >
          Sign in
        </button>
        <button
          className={`btn ${mode === "signup" ? "bg-slate-800" : ""}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder={mode === "signin" ? "Your password" : "Create a password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </form>
    </div>
  );
}
