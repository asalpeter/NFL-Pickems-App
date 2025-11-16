"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthPage() {
  const router = useRouter();
  const supabase = getBrowserSupabase();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function syncCookies(event: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch("/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ event, session }),
      keepalive: true,
    });
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setPending(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        await syncCookies("SIGNED_IN");
        router.replace("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
          setMsg(
            "Check your email to confirm your account. Once confirmed, come back to sign in."
          );
          return;
        }

        await syncCookies("SIGNED_IN");
        router.replace("/onboarding");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="card w-full max-w-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="leading-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <div className="flex rounded-xl border border-slate-700 overflow-hidden shrink-0">
            <button
              className={`px-3 py-1 text-sm ${
                mode === "signin" ? "bg-slate-800" : ""
              }`}
              onClick={() => {
                setMode("signin");
                setMsg(null);
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`px-3 py-1 text-sm ${
                mode === "signup" ? "bg-slate-800" : ""
              }`}
              onClick={() => {
                setMode("signup");
                setMsg(null);
              }}
              type="button"
            >
              Create account
            </button>
          </div>
        </div>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="btn justify-center" type="submit" disabled={pending}>
            {pending
              ? mode === "signin"
                ? "Signing in..."
                : "Creating..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        {mode === "signin" && (
          <p className="text-xs text-slate-400 mt-3">
            Don’t have an account?{" "}
            <button
              className="underline decoration-dotted"
              onClick={() => setMode("signup")}
              type="button"
            >
              Create one
            </button>
            .
          </p>
        )}

        {msg && <p className="mt-3 text-sm text-slate-200">{msg}</p>}
      </div>
    </div>
  );
}
