"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Mode = "signin" | "signup";
type Method = "password" | "magic";

export default function AuthPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "/auth/callback";

  // If already signed in, bounce to callback to continue onboarding flow
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
      if (method === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        alert("Magic link sent. Check your email.");
        return;
      }

      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) router.replace("/auth/callback");
        return;
      } else {
        // sign up with email+password
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        // Depending on your Supabase Auth settings, email confirmation might be required.
        if (!data.session) {
          alert("Check your email to confirm your account.");
          return;
        }
        router.replace("/auth/callback");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      // user will be redirected away; no further action here
    } catch (e: any) {
      setErr(e?.message ?? "OAuth failed.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 card">
      <h1 className="text-xl mb-4">Welcome</h1>

      {/* Mode toggle */}
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

      {/* Method toggle */}
      <div className="flex gap-2 mb-4">
        <button
          className={`btn ${method === "password" ? "bg-slate-800" : ""}`}
          onClick={() => setMethod("password")}
          type="button"
        >
          Email + Password
        </button>
        <button
          className={`btn ${method === "magic" ? "bg-slate-800" : ""}`}
          onClick={() => setMethod("magic")}
          type="button"
        >
          Magic Link
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

        {method === "password" && (
          <input
            className="input"
            type="password"
            placeholder={mode === "signin" ? "Your password" : "Create a password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
          />
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : method === "magic"
            ? "Send magic link"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>

        {err && <p className="text-red-400 text-sm">{err}</p>}
      </form>

      {/* Optional OAuth */}
      <div className="mt-6">
        <button className="btn w-full" onClick={signInWithGoogle} disabled={busy}>
          Continue with Google
        </button>
        <p className="text-slate-500 text-xs mt-2">
          (Enable Google in Supabase → Auth → Providers before using this.)
        </p>
      </div>
    </div>
  );
}
