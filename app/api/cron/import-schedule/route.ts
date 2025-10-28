/*
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseCSV } from "@/lib/csv";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const feed = process.env.SCHEDULE_FEED_URL;
  if (!feed) return NextResponse.json({ error: "SCHEDULE_FEED_URL not set" }, { status: 500 });

  const seasonFilter = Number(process.env.SCHEDULE_SEASON || new Date().getUTCFullYear());
  const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

  const pick = (o: Record<string, any>, keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  const composeIso = (dateVal?: any, timeVal?: any) => {
    const d = dateVal ? String(dateVal).trim() : "";
    const t0 = timeVal ? String(timeVal).trim() : "";
    if (!d || !t0) return null;
    const t = /^\d{2}:\d{2}$/.test(t0) ? `${t0}:00` : t0; // HH:MM -> HH:MM:00
    return `${d}T${t}Z`;
  };

  const normalizeKickoff = (row: Record<string, any>): string | null => {
    const direct = pick(row, [
      "kickoff","start_time","game_datetime","gamedatetime","game_time_eastern","starttime"
    ]);
    if (direct) {
      const kd = String(direct).trim();
      if (DATE_PREFIX.test(kd)) return kd; // only accept if begins YYYY-MM-DD
    }
    const dateField = pick(row, ["gameday","date","game_date"]);
    const timeField = pick(row, ["gametime","time","game_time","game_time_eastern"]);
    const composed = composeIso(dateField, timeField);
    return composed && DATE_PREFIX.test(composed) ? composed : null;
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!     // service role to bypass RLS
  );

  try {
    const res = await fetch(feed, { cache: "no-store" });
    const csv = await res.text();
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 500 });

    const raw = parseCSV(csv); // robust CSV → array of objects
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "parsed 0 rows from CSV" }, { status: 500 });
    }

    type Row = { season: number; week: number; home: string; away: string; kickoff: string | null; is_tiebreaker: boolean };
    const rows: Row[] = [];

    for (const r of raw) {
      const season = Number(pick(r, ["season","Season","year","Year"]));
      if (!Number.isFinite(season) || season !== seasonFilter) continue;

      const week = Number(pick(r, ["week","Week","game_week","Game_Week"]));
      const home = String(pick(r, ["home_team","home","Home","team_home","team_h"]) ?? "").trim();
      const away = String(pick(r, ["away_team","away","Away","team_away","team_a"]) ?? "").trim();
      if (!Number.isFinite(week) || !home || !away) continue;

      const kickoff = normalizeKickoff(r);
      const is_tiebreaker = false;

      rows.push({ season, week, home, away, kickoff, is_tiebreaker });
    }

    if (rows.length === 0) return NextResponse.json({ error: "no valid rows after normalization" }, { status: 500 });

    // weeks
    const weeksMap = new Map<string, { season: number; week: number; starts_on: string | null }>();
    for (const r of rows) {
      const key = `${r.season}-${r.week}`;
      if (!weeksMap.has(key)) {
        const k = (r.kickoff ?? "").toString().trim();
        const starts_on = DATE_PREFIX.test(k) ? k.slice(0, 10) : null;
        weeksMap.set(key, { season: r.season, week: r.week, starts_on });
      }
    }
    const weeks = Array.from(weeksMap.values());
    if (weeks.length) {
      const w = await supabase.from("weeks").upsert(weeks, { onConflict: "season,week" });
      if (w.error) return NextResponse.json({ error: w.error.message }, { status: 500 });
    }

    // games
    let count = 0;
    for (const r of rows) {
      const g = await supabase
        .from("games")
        .upsert(
          { season: r.season, week: r.week, home: r.home, away: r.away, kickoff: r.kickoff, is_tiebreaker: r.is_tiebreaker },
          { onConflict: "season,week,home,away" }
        );
      if (g.error) return NextResponse.json({ error: g.error.message }, { status: 500 });
      count++;
    }

    return NextResponse.json({ ok: true, count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
*/
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseCSV } from "@/lib/csv";

/**
 * Imports the schedule from a CSV feed (nfldata games.csv recommended),
 * upserts weeks & games, then ensures exactly ONE random tiebreaker game
 * per (season, week). Idempotent.
 *
 * Env:
 *  - CRON_SECRET
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - SCHEDULE_FEED_URL  (e.g., https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv)
 *  - SCHEDULE_SEASON    (e.g., 2025) — defaults to current UTC year
 */
export async function POST(req: Request) {
  // --- auth
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const feed = process.env.SCHEDULE_FEED_URL;
  if (!feed) return NextResponse.json({ error: "SCHEDULE_FEED_URL not set" }, { status: 500 });

  const seasonFilter = Number(process.env.SCHEDULE_SEASON || new Date().getUTCFullYear());
  const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

  // --- supabase (service role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // helpers
  const pick = (o: Record<string, any>, keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };
  const composeIso = (dateVal?: any, timeVal?: any) => {
    const d = dateVal ? String(dateVal).trim() : "";
    const t0 = timeVal ? String(timeVal).trim() : "";
    if (!d || !t0) return null;
    const t = /^\d{2}:\d{2}$/.test(t0) ? `${t0}:00` : t0; // HH:MM → HH:MM:00
    return `${d}T${t}Z`;
  };
  const normalizeKickoff = (row: Record<string, any>): string | null => {
    const direct = pick(row, [
      "kickoff","start_time","game_datetime","gamedatetime","game_time_eastern","starttime"
    ]);
    if (direct) {
      const kd = String(direct).trim();
      if (DATE_PREFIX.test(kd)) return kd; // only accept if begins with YYYY-MM-DD
    }
    const dateField = pick(row, ["gameday","date","game_date"]);
    const timeField = pick(row, ["gametime","time","game_time","game_time_eastern"]);
    const composed = composeIso(dateField, timeField);
    return composed && DATE_PREFIX.test(composed) ? composed : null;
  };

  try {
    // --- fetch feed
    const res = await fetch(feed, { cache: "no-store" });
    const csv = await res.text();
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 500 });

    // --- parse & normalize
    const raw = parseCSV(csv); // Array<Record<string,string>>
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "parsed 0 rows from CSV" }, { status: 500 });
    }

    type Row = { season:number; week:number; home:string; away:string; kickoff:string|null; is_tiebreaker:boolean };
    const rows: Row[] = [];

    for (const r of raw) {
      const season = Number(pick(r, ["season","Season","year","Year"]));
      if (!Number.isFinite(season) || season !== seasonFilter) continue;

      const week = Number(pick(r, ["week","Week","game_week","Game_Week"]));
      const home = String(pick(r, ["home_team","home","Home","team_home","team_h"]) ?? "").trim();
      const away = String(pick(r, ["away_team","away","Away","team_away","team_a"]) ?? "").trim();
      if (!Number.isFinite(week) || !home || !away) continue;

      const kickoff = normalizeKickoff(r);
      rows.push({ season, week, home, away, kickoff, is_tiebreaker: false });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "no valid rows after normalization" }, { status: 500 });
    }

    // --- weeks (unique season+week), with safe starts_on (DATE or NULL)
    const weeksMap = new Map<string, { season:number; week:number; starts_on:string|null }>();
    for (const r of rows) {
      const key = `${r.season}-${r.week}`;
      if (!weeksMap.has(key)) {
        const k = (r.kickoff ?? "").toString().trim();
        const starts_on = DATE_PREFIX.test(k) ? k.slice(0, 10) : null;
        weeksMap.set(key, { season: r.season, week: r.week, starts_on });
      }
    }
    const weeks = Array.from(weeksMap.values());
    if (weeks.length) {
      const w = await supabase.from("weeks").upsert(weeks, { onConflict: "season,week" });
      if (w.error) return NextResponse.json({ error: w.error.message }, { status: 500 });
    }

    // --- games
    let count = 0;
    for (const r of rows) {
      const g = await supabase
        .from("games")
        .upsert(
          { season: r.season, week: r.week, home: r.home, away: r.away, kickoff: r.kickoff, is_tiebreaker: r.is_tiebreaker },
          { onConflict: "season,week,home,away" }
        );
      if (g.error) return NextResponse.json({ error: g.error.message }, { status: 500 });
      count++;
    }

    // --- Auto tiebreaker: exactly ONE per (season, week)
    const { data: weekRows, error: wErr } = await supabase
      .from("weeks")
      .select("week")
      .eq("season", seasonFilter)
      .order("week");
    if (wErr) console.error("[cron/import] weeks fetch error", wErr);

    for (const w of weekRows ?? []) {
      const wk = Number(w.week);

      // already have one?
      const { data: existing, error: eErr } = await supabase
        .from("games")
        .select("id")
        .eq("season", seasonFilter)
        .eq("week", wk)
        .eq("is_tiebreaker", true)
        .limit(1);
      if (eErr) { console.error("[cron/import] tiebreaker check err", eErr); continue; }
      if ((existing ?? []).length) continue;

      // pick a candidate (prefer ones with kickoff)
      const { data: candidates, error: cErr } = await supabase
        .from("games")
        .select("id,kickoff")
        .eq("season", seasonFilter)
        .eq("week", wk);
      if (cErr) { console.error("[cron/import] tiebreaker candidates err", cErr); continue; }
      if (!candidates?.length) continue;

      const withTime = candidates.filter(g => !!g.kickoff);
      const pool = withTime.length ? withTime : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];

      // ensure exactly one
      await supabase.from("games")
        .update({ is_tiebreaker: false })
        .eq("season", seasonFilter).eq("week", wk);
      await supabase.from("games")
        .update({ is_tiebreaker: true })
        .eq("id", pick.id);
    }

    return NextResponse.json({ ok: true, count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
