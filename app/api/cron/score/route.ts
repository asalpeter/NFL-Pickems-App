import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' ) {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const TEAM_MAP: Record<string, string> = {
  ARI:"ARI", ATL:"ATL", BAL:"BAL", BUF:"BUF", CAR:"CAR", CHI:"CHI", CIN:"CIN", CLE:"CLE",
  DAL:"DAL", DEN:"DEN", DET:"DET", GB:"GB", GNB:"GB", HOU:"HOU", IND:"IND", JAX:"JAX", JAC:"JAX",
  KC:"KC", KAN:"KC", LAC:"LAC", LAR:"LAR", LV:"LV", LVR:"LV", MIA:"MIA", MIN:"MIN",
  NE:"NE", NWE:"NE", NO:"NO", NOR:"NO", NYG:"NYG", NYJ:"NYJ", PHI:"PHI", PIT:"PIT",
  SEA:"SEA", SF:"SF", SFO:"SF", TB:"TB", TAM:"TB", TEN:"TEN", WAS:"WAS", WSH:"WAS"
};
const norm = (abbr?: string) => (abbr ? (TEAM_MAP[abbr.toUpperCase()] ?? abbr.toUpperCase()) : "");

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const u = new URL(req.url);
  const season = Number(u.searchParams.get("season") || new Date().getUTCFullYear());
  const weekParam = u.searchParams.get("week");
  const allWeeks = u.searchParams.get("allWeeks") === "true";

  try {
    const feed = process.env.SCORE_FEED_URL
      || "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
    const r = await fetch(feed, { cache: "no-store" });
    const text = await r.text();
    if (!r.ok) return NextResponse.json({ error: `score feed failed ${r.status}` }, { status: 500 });

    const rows = parseCSV(text);

    const bySeason = rows.filter(row => {
      const s = Number(row["season"] || row["year"]);
      return Number.isFinite(s) && s === season;
    });

    let targetWeeks: number[] = [];
    if (weekParam) {
      targetWeeks = [Number(weekParam)];
    } else if (allWeeks) {
      const set = new Set<number>();
      for (const r of bySeason) {
        const w = Number(r["week"] || r["game_week"]);
        if (Number.isFinite(w)) set.add(w);
      }
      targetWeeks = [...set].sort((a,b)=>a-b);
    } else {
      const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: need, error } = await supa
        .from("games")
        .select("week")
        .eq("season", season)
        .is("winner", null)
        .lt("kickoff", new Date().toISOString());
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      targetWeeks = [...new Set((need ?? []).map((g:any)=>g.week))];
    }

    type Up = { season:number; week:number; home:string; away:string; home_score:number; away_score:number; winner:string|null };
    const ups: Up[] = [];

    for (const r of bySeason) {
      const w = Number(r["week"] || r["game_week"]);
      if (!targetWeeks.includes(w)) continue;

      const home = norm(r["home_team"] || r["home"]);
      const away = norm(r["away_team"] || r["away"]);

      const hs = Number(r["home_score"] || r["home_pts"] || r["home_points"]);
      const as = Number(r["away_score"] || r["away_pts"] || r["away_points"]);

      if (!home || !away || !Number.isFinite(hs) || !Number.isFinite(as)) continue;

      const winner = hs > as ? "HOME" : hs < as ? "AWAY" : null;
      ups.push({ season, week: w, home, away, home_score: hs, away_score: as, winner });
    }

    if (!ups.length) {
      return NextResponse.json({ ok: true, weeks: targetWeeks, updated: 0, note: "no score rows found" });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let updated = 0;

    for (const uWeek of [...new Set(ups.map(u => u.week))]) {
      const batch = ups.filter(u => u.week === uWeek);

      const { data: games, error: gerr } = await supabase
        .from("games")
        .select("home,away")
        .eq("season", season)
        .eq("week", uWeek);
      if (gerr) return NextResponse.json({ error: gerr.message }, { status: 500 });

      const present = new Set((games ?? []).map((g:any) => `${g.home}-@-${g.away}`));

      for (const u of batch) {
        if (!present.has(`${u.home}-@-${u.away}`)) continue;

        const patch: any = { home_score: u.home_score, away_score: u.away_score };
        
        if (u.winner !== null) patch.winner = u.winner;

        const resp = await supabase
          .from("games")
          .update(patch)
          .eq("season", u.season)
          .eq("week", u.week)
          .eq("home", u.home)
          .eq("away", u.away);
        if (!resp.error) updated += resp.count || 0;
      }
    }

    return NextResponse.json({ ok: true, weeks: targetWeeks, updated });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
