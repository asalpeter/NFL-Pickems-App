"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthListener() {
  const router = useRouter();
  const pathname = usePathname();
  const posting = useRef(false);

  async function sync(event: string) {
    // prevent overlapping POSTs, but allow subsequent events
    if (posting.current) return;
    posting.current = true;
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      await fetch("/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ event, session }),
        keepalive: true,
      });

      // Always refresh RSC so server components (header) reflect new session immediately
      router.refresh();

      // Optional UX: if user is on /auth and just signed in, send them to dashboard
      if (event === "SIGNED_IN" && pathname?.startsWith("/auth")) {
        router.replace("/dashboard");
      }

      // Redirect home on sign-out
      if (event === "SIGNED_OUT") {
        router.push("/");
      }
    } finally {
      posting.current = false;
    }
  }

  useEffect(() => {
    const supabase = getBrowserSupabase();

    // 1) Initial sync covers already-signed-in sessions and updates header on hard load
    void sync("INIT");

    // 2) React to every auth state change (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => { await sync(event); }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
