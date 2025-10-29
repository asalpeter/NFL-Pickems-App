"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

// ensure this route is not prerendered
export const dynamic = "force-dynamic";
export const revalidate = 0;

function CallbackInner() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      try {
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("No user session found. Try signing in again.");
          return;
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        if (prof?.username) {
          router.replace("/"); // already onboarded
        } else {
          router.replace("/onboarding"); // pick username
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

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-6 card">
          <p className="text-slate-300">Completing sign-in…</p>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
