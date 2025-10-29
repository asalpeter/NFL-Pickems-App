import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league_id = searchParams.get("league_id");
  const season = Number(searchParams.get("season") || "2025");
  const week = Number(searchParams.get("week") || "1");
  if (!league_id) return NextResponse.json({ error: "league_id required" }, { status: 400 });

  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("weekly_winners")
    .select("*")
    .eq("league_id", league_id)
    .eq("season", season)
    .eq("week", week)
    .order("week_rank", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
  let names: Record<string, string | null> = {};
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", ids);
    (profs ?? []).forEach((p: any) => { names[p.id] = p.username; });
  }

  const enriched = (data ?? []).map((r: any) => ({
    ...r,
    username: names[r.user_id] ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
