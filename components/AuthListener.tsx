"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Sync client auth -> server cookies
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });
        // Re-render server components (header) with fresh cookies
        router.refresh();
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
