"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      try {
        // Supabase sends ?code=...&redirect_to=...
        const url = new URL(window.location.href);
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // fetch profile to see if username already set
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("No user session found. Try signing in again.");
          return;
        }
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) {
          // even if profiles row isn't there yet, send to onboarding (trigger will create it)
          router.replace("/onboarding");
          return;
        }
        if (prof?.username) {
          router.replace("/"); // already has a username → send home (or /leagues)
        } else {
          router.replace("/onboarding");
        }
      } catch (e: any) {
        setMsg(e?.message ?? "Sign-in failed.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 card">
      <p className="text-slate-300">{msg}</p>
    </div>
  );
}
