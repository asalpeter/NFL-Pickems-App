import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

// Set WEBHOOK_SECRET in project envs (Vercel) to authenticate the scoring webhook

export async function POST(req: Request) {
  const secret = req.headers.get('x-webhook-secret');
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await req.json();
  // payload: { season, week, home, away, home_score, away_score }
  const { season, week, home, away, home_score, away_score } = payload || {};
  if (!season || !week || !home || !away) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const winner = (home_score > away_score) ? 'HOME' : (away_score > home_score) ? 'AWAY' : null;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('games')
    .update({ home_score, away_score, winner })
    .eq('season', season).eq('week', week).eq('home', home).eq('away', away)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, game: data });
}
