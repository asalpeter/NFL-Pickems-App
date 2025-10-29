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
      const { data: { session } } = await supabase.auth.getSession();

      await fetch("/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ event: event ?? "INIT", session }),
        keepalive: true,
      });

      // Refresh server components (e.g., header) after cookie sync
      setTimeout(() => router.refresh(), 0);
    } finally {
      posting.current = false;
    }
  }

  useEffect(() => {
    const supabase = getBrowserSupabase();

    // Initial sync on mount (covers already-signed-in users)
    sync("INIT");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      await sync(event);
      if (event === "SIGNED_OUT") {
        router.push("/"); // ⟵ navigate home on any sign-out event
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
