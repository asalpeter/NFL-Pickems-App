import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league_id = searchParams.get('league_id');
  const season = Number(searchParams.get('season') || '2025');
  if (!league_id) return NextResponse.json({ error: "league_id required" }, { status: 400 });
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from('standings').select('*').eq('league_id', league_id).eq('season', season);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
