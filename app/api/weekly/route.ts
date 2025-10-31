import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Q = z.object({
  league_id: z.string().min(1),
  season: z.coerce.number().int().min(1900).max(3000).default(2025),
  week: z.coerce.number().int().min(1).max(22).default(1),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    league_id: url.searchParams.get("league_id"),
    season: url.searchParams.get("season"),
    week: url.searchParams.get("week"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { league_id, season, week } = parsed.data;

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
    (profs ?? []).forEach((p: any) => (names[p.id] = p.username));
  }

  const enriched = (data ?? []).map((r: any) => ({
    ...r,
    username: names[r.user_id] ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
