/*
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TEAM_MAP: Record<string, string> = {
  ARI:"ARI", ATL:"ATL", BAL:"BAL", BUF:"BUF", CAR:"CAR", CHI:"CHI", CIN:"CIN", CLE:"CLE",
  DAL:"DAL", DEN:"DEN", DET:"DET", GB:"GB", GNB:"GB", HOU:"HOU", IND:"IND", JAX:"JAX", JAC:"JAX",
  KC:"KC", KAN:"KC", LAC:"LAC", LAR:"LAR", LV:"LV", LVR:"LV", MIA:"MIA", MIN:"MIN",
  NE:"NE", NWE:"NE", NO:"NO", NOR:"NO", NYG:"NYG", NYJ:"NYJ", PHI:"PHI", PIT:"PIT",
  SEA:"SEA", SF:"SF", SFO:"SF", TB:"TB", TAM:"TB", TEN:"TEN", WAS:"WAS", WSH:"WAS"
};
const norm = (abbr?: string) => (abbr ? (TEAM_MAP[abbr.toUpperCase()] ?? abbr.toUpperCase()) : "");

type Update = { season:number; week:number; home:string; away:string; home_score:number; away_score:number; winner:string|null };

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const season = Number(url.searchParams.get("season") || new Date().getUTCFullYear());
  const weekParam = url.searchParams.get("week");       // if present → single week
  const allWeeks = url.searchParams.get("allWeeks") === "true"; // backfill all weeks with games

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role (RLS bypass)
  );

  // Which weeks to score?
  let weeks: number[] = [];
  if (weekParam) {
    weeks = [Number(weekParam)];
  } else if (allWeeks) {
    // all weeks that exist for the season
    const { data, error } = await supabase
      .from("weeks")
      .select("week")
      .eq("season", season)
      .order("week");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    weeks = (data ?? []).map((w:any) => w.week);
  } else {
    // default: current week heuristic → any week this season with games whose winner is null AND kickoff < now
    const { data, error } = await supabase
      .from("games")
      .select("week")
      .eq("season", season)
      .is("winner", null)
      .lt("kickoff", new Date().toISOString())
      .order("week");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    weeks = [...new Set((data ?? []).map((g:any) => g.week))];
  }

  const base = process.env.ESPN_SCOREBOARD_URL
    || "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

  let updated = 0;
  const logs: any[] = [];

  for (const week of weeks) {
    try {
      const espn = new URL(base);
      espn.searchParams.set("season", String(season));
      espn.searchParams.set("week", String(week));
      espn.searchParams.set("seasontype", "2"); // regular season
      const res = await fetch(espn.toString(), { cache: "no-store" });
      if (!res.ok) {
        logs.push({ week, err: `ESPN ${res.status}` });
        continue;
      }
      const json: any = await res.json();
      const events: any[] = json?.events ?? [];

      // Build updates from ESPN
      const ups: Update[] = [];
      for (const ev of events) {
        const comp = ev?.competitions?.[0];
        if (!comp) continue;

        const status = comp?.status?.type?.state; // e.g., "pre", "in", "post"
        const done = ["post"].includes((status || "").toLowerCase());

        // still update live scores but set winner only when final
        const comps: any[] = comp?.competitors ?? [];
        const homeC = comps.find(c => c.homeAway === "home");
        const awayC = comps.find(c => c.homeAway === "away");
        const home = norm(homeC?.team?.abbreviation);
        const away = norm(awayC?.team?.abbreviation);
        const home_score = Number(homeC?.score ?? 0);
        const away_score = Number(awayC?.score ?? 0);

        let winner: string | null = null;
        if (done) {
          winner = home_score > away_score ? "HOME"
                : away_score > home_score ? "AWAY"
                : null; // ties possible
        }

        if (home && away) ups.push({ season, week, home, away, home_score, away_score, winner });
      }

      if (!ups.length) continue;

      // Fetch our games to make sure keys match
      const { data: games, error: gerr } = await supabase
        .from("games")
        .select("home,away")
        .eq("season", season)
        .eq("week", week);
      if (gerr) return NextResponse.json({ error: gerr.message }, { status: 500 });

      const setKey = new Set((games ?? []).map((g:any) => `${g.home}-@-${g.away}`));

      // Apply updates
      for (const u of ups) {
        if (!setKey.has(`${u.home}-@-${u.away}`)) continue;
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
    } catch (e:any) {
      logs.push({ week, err: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, weeks, updated, logs });
}
*/

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Very light CSV parser for our use (handles quotes)
// If you already have a robust parseCSV in lib, import and use that instead.
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
    // 1) fetch master games file (scores included mid-season)
    const feed = process.env.SCORE_FEED_URL
      || "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
    const r = await fetch(feed, { cache: "no-store" });
    const text = await r.text();
    if (!r.ok) return NextResponse.json({ error: `score feed failed ${r.status}` }, { status: 500 });

    const rows = parseCSV(text);

    // 2) Filter rows for our season (and weeks selection)
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
      // default: any weeks with kickoff < now and winner still null
      // We'll load the weeks from DB to know which exist
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

    // 3) Build updates from nfldata rows
    type Up = { season:number; week:number; home:string; away:string; home_score:number; away_score:number; winner:string|null };
    const ups: Up[] = [];

    for (const r of bySeason) {
      const w = Number(r["week"] || r["game_week"]);
      if (!targetWeeks.includes(w)) continue;

      const home = norm(r["home_team"] || r["home"]);
      const away = norm(r["away_team"] || r["away"]);

      const hs = Number(r["home_score"] || r["home_pts"] || r["home_points"]);
      const as = Number(r["away_score"] || r["away_pts"] || r["away_points"]);

      // only update when we actually have numeric scores
      if (!home || !away || !Number.isFinite(hs) || !Number.isFinite(as)) continue;

      const winner = hs > as ? "HOME" : hs < as ? "AWAY" : null; // ties => null
      ups.push({ season, week: w, home, away, home_score: hs, away_score: as, winner });
    }

    if (!ups.length) {
      return NextResponse.json({ ok: true, weeks: targetWeeks, updated: 0, note: "no score rows found" });
    }

    // 4) Apply to DB
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let updated = 0;

    for (const uWeek of [...new Set(ups.map(u => u.week))]) {
      const batch = ups.filter(u => u.week === uWeek);

      // Get matching games so we only update known pairs
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
        // only set winner if clear (no tie)
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
