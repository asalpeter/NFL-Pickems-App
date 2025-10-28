import { NextResponse } from "next/server";

/**
 * Normalizes nflverse/nfldata "games.csv" → CSV your importer expects:
 *   season,week,kickoff,home,away,is_tiebreaker
 *
 * Query: ?season=YYYY (defaults to current UTC year)
 */
function toCSV(rows: any[]): string {
  const header = ["season", "week", "kickoff", "home", "away", "is_tiebreaker"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.season,
      r.week,
      r.kickoff ?? "",
      r.home,
      r.away,
      "false",
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

function detect(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const idx = headers.indexOf(a);
    if (idx >= 0) return idx;
  }
  return -1;
}

// Optional: map PFR-style codes to common abbreviations
const TEAM_MAP: Record<string, string> = {
  ARI:"ARI", ATL:"ATL", BAL:"BAL", BUF:"BUF", CAR:"CAR", CHI:"CHI", CIN:"CIN", CLE:"CLE",
  DAL:"DAL", DEN:"DEN", DET:"DET", GNB:"GB", GB:"GB", HOU:"HOU", IND:"IND", JAX:"JAX", JAC:"JAX",
  KAN:"KC", KC:"KC", LAC:"LAC", LAR:"LAR", LVR:"LV", LV:"LV", MIA:"MIA", MIN:"MIN",
  NE:"NE", NWE:"NE", NO:"NO", NOR:"NO", NYG:"NYG", NYJ:"NYJ", PHI:"PHI", PIT:"PIT",
  SEA:"SEA", SFO:"SF", SF:"SF", TB:"TB", TAM:"TB", TEN:"TEN", WAS:"WAS", WSH:"WAS"
};
function normTeam(x: string | undefined): string {
  if (!x) return "";
  const t = x.toUpperCase();
  return TEAM_MAP[t] || t;
}

export async function GET(req: Request) {
  try {
    const rawUrl =
      process.env.NFLVERSE_SCHEDULE_CSV ||
      "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

    const url = new URL(req.url);
    const qSeason = url.searchParams.get("season");
    const season = Number(qSeason || new Date().getUTCFullYear());

    console.log("[adapter/nflverse] fetching:", rawUrl, "season:", season);
    const res = await fetch(rawUrl, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      console.error("[adapter/nflverse] upstream", res.status, text.slice(0, 300));
      return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 500 });
    }

    const linesAll = text.trim().split(/\r?\n/);
    if (!linesAll.length) return NextResponse.json({ error: "empty csv" }, { status: 500 });
    const headerLine = linesAll[0];
    const headers = headerLine.split(",").map(h => h.trim().toLowerCase());
    const lines = linesAll.slice(1);

    // Try lots of aliases (nfldata evolves)
    const idx = {
      season: detect(headers, ["season","year"]),
      week: detect(headers, ["week","game_week"]),
      home: detect(headers, ["home_team","home","team_home","team_h"]),
      away: detect(headers, ["away_team","away","team_away","team_a"]),
      kickoff: detect(headers, ["gametime","kickoff","start_time","game_datetime","gamedatetime","game_time_eastern"]),
      gameday: detect(headers, ["gameday","date","game_date"]),
      gametime: detect(headers, ["gametime","time"]),
    };
    console.log("[adapter/nflverse] detected indices:", idx);
    console.log("[adapter/nflverse] headers:", headers.slice(0, 20));

    const out: any[] = [];
    for (const line of lines) {
      // naive CSV split (works for nfldata; if not, swap to a real CSV parser)
      const cols = line.split(",").map(c => c.trim());

      const s = idx.season >= 0 ? parseInt(cols[idx.season], 10) : NaN;
      if (s !== season) continue;

      const w = idx.week >= 0 ? parseInt(cols[idx.week], 10) : NaN;
      const homeRaw = idx.home >= 0 ? cols[idx.home] : "";
      const awayRaw = idx.away >= 0 ? cols[idx.away] : "";

      let kickoff = "";
      if (idx.kickoff >= 0) kickoff = cols[idx.kickoff];
      else if (idx.gameday >= 0 && idx.gametime >= 0) {
        const d = cols[idx.gameday];
        const t = cols[idx.gametime];
        kickoff = `${d}T${t}:00Z`.replace(" ", "T");
      }

      if (!Number.isFinite(s) || !Number.isFinite(w) || !homeRaw || !awayRaw) continue;

      out.push({
        season: s,
        week: w,
        kickoff,
        home: normTeam(homeRaw),
        away: normTeam(awayRaw),
        is_tiebreaker: false,
      });
    }

    if (!out.length) {
      console.warn("[adapter/nflverse] no rows for season", season, "- first data line:", lines[0]);
      return NextResponse.json({ error: `no rows for season ${season}` }, { status: 404 });
    }

    console.log("[adapter/nflverse] rows out:", out.length, "example:", out[0]);
    const csv = toCSV(out);
    return new NextResponse(csv, {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("[adapter/nflverse] error:", e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
