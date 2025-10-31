"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/useToast";

export default function AuthPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirectTo") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast(error.message);
        } else {
          router.replace(redirectTo);
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast(error.message);
        } else {
          // optional: create profile row in RLS setup
          router.replace(redirectTo);
          router.refresh();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
        {/* header row: title on left, toggle on right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-3xl font-semibold leading-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <div className="inline-flex rounded-full border border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={
                "px-4 py-2 text-sm font-medium " +
                (mode === "signin" ? "bg-slate-800 text-white" : "text-slate-200")
              }
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={
                "px-4 py-2 text-sm font-medium " +
                (mode === "signup" ? "bg-slate-800 text-white" : "text-slate-200")
              }
            >
              Create account
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span>Email</span>
            <input
              required
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === "signin" ? "email" : "new-email"}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Password</span>
            <input
              required
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="btn justify-center w-full h-11 text-base"
          >
            {loading
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
