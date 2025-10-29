import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league_id = searchParams.get("league_id");
  const season = Number(searchParams.get("season") || "2025");
  if (!league_id) return NextResponse.json({ error: "league_id required" }, { status: 400 });

  const supabase = await getServerSupabase();

  // Picks for league (all weeks in season)
  const { data: picks, error: pErr } = await supabase
    .from("picks")
    .select("user_id, game_id, pick")
    .eq("league_id", league_id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Winners for games in season
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("id, winner")
    .eq("season", season);
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

  const winByGame: Record<string, "HOME" | "AWAY" | null> = {};
  (games ?? []).forEach((g: any) => { winByGame[g.id] = (g.winner as any) ?? null; });

  // Aggregate wins per user
  const winCount: Record<string, number> = {};
  (picks ?? []).forEach((p: any) => {
    const winner = winByGame[p.game_id];
    if (winner && p.pick === winner) {
      winCount[p.user_id] = (winCount[p.user_id] || 0) + 1;
    }
  });

  // Join usernames
  const userIds = Object.keys(winCount);
  let names: Record<string, string | null> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    (profs ?? []).forEach((p: any) => { names[p.id] = p.username; });
  }

  const data = Object.entries(winCount)
    .map(([user_id, wins]) => ({ user_id, wins, username: names[user_id] ?? null }))
    .sort((a, b) => b.wins - a.wins);

  return NextResponse.json({ data });
}
