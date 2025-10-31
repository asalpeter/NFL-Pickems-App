import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Q = z.object({
  league_id: z.string().min(1),
  season: z.coerce.number().int().min(1900).max(3000).default(2025),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    league_id: url.searchParams.get("league_id"),
    season: url.searchParams.get("season"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { league_id, season } = parsed.data;

  const supabase = await getServerSupabase();

  const { data: picks, error: pErr } = await supabase
    .from("picks")
    .select("user_id, game_id, pick")
    .eq("league_id", league_id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("id, winner, season")
    .eq("season", season);
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

  const winByGame: Record<string, "HOME" | "AWAY" | null> = {};
  (games ?? []).forEach((g: any) => (winByGame[g.id] = (g.winner as any) ?? null));

  const winCount: Record<string, number> = {};
  (picks ?? []).forEach((p: any) => {
    const w = winByGame[p.game_id];
    if (w && p.pick === w) winCount[p.user_id] = (winCount[p.user_id] || 0) + 1;
  });

  const userIds = Object.keys(winCount);
  let names: Record<string, string | null> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    (profs ?? []).forEach((p: any) => (names[p.id] = p.username));
  }

  const data = Object.entries(winCount)
    .map(([user_id, wins]) => ({ user_id, wins, username: names[user_id] ?? null }))
    .sort((a, b) => b.wins - a.wins);

  return NextResponse.json({ data });
}
