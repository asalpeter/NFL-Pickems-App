"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

function CallbackInner() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("No active session. Please sign in.");
          router.replace("/auth");
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        router.replace(prof?.username ? "/" : "/onboarding");
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? "Sign-in failed.");
      }
    })();
  }, [supabase, router]);

  return (
    <div className="max-w-md mx-auto p-6 card">
      <p className="text-slate-300">{msg}</p>
    </div>
  );
}

export default function ClientCallback() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto p-6 card">
        <p className="text-slate-300">Completing sign-in…</p>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
