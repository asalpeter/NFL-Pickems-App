"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthListener() {
  const router = useRouter();
  const posting = useRef(false);

  async function sync(event?: string) {
    if (posting.current) return;
    posting.current = true;
    try {
      const supabase = getBrowserSupabase();
      // Always send current session so server cookies stay in sync
      const { data: { session } } = await supabase.auth.getSession();

      await fetch("/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ event: event ?? "INIT", session }),
        keepalive: true, // survives page nav
      });

      // Let cookies settle, then refresh RSC (header updates immediately)
      // tiny delay helps if a navigation is in flight
      setTimeout(() => router.refresh(), 0);
    } finally {
      posting.current = false;
    }
  }

  useEffect(() => {
    const supabase = getBrowserSupabase();

    // 1) Sync once on first mount (covers already-signed-in users)
    sync("INIT");

    // 2) Sync on every auth event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        await sync(event);
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
