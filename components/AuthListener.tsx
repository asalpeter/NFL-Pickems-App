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
        // Tell the server to sync cookies with the current session
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });

        // Refresh RSC payload so server components (header) re-render with new auth
        router.refresh();
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
