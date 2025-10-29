import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

// Receives auth state changes from the client and syncs server cookies.
export async function POST(req: Request) {
  const { event, session } = await req.json();
  const supabase = await getServerSupabase();

  try {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    } else if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "auth sync failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
