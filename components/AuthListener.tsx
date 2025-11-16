"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthListener() {
  const router = useRouter();
  const pathname = usePathname();
  const posting = useRef(false);

  async function sync(event: string) {
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

      router.refresh();

      if (event === "SIGNED_IN" && pathname?.startsWith("/auth")) {
        router.replace("/dashboard");
      }

      if (event === "SIGNED_OUT") {
        router.push("/");
      }
    } finally {
      posting.current = false;
    }
  }

  useEffect(() => {
    const supabase = getBrowserSupabase();

    void sync("INIT");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => { await sync(event); }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
