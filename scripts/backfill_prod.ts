import 'cross-fetch/polyfill';
import { createClient } from '@supabase/supabase-js';

const TEAM_MAP: Record<string, string> = {
  ARI:"ARI", ATL:"ATL", BAL:"BAL", BUF:"BUF", CAR:"CAR", CHI:"CHI", CIN:"CIN", CLE:"CLE",
  DAL:"DAL", DEN:"DEN", DET:"DET", GB:"GB", GNB:"GB", HOU:"HOU", IND:"IND", JAX:"JAX", JAC:"JAX",
  KC:"KC", KAN:"KC", LAC:"LAC", LAR:"LAR", LV:"LV", LVR:"LV", MIA:"MIA", MIN:"MIN",
  NE:"NE", NWE:"NE", NO:"NO", NOR:"NO", NYG:"NYG", NYJ:"NYJ", PHI:"PHI", PIT:"PIT",
  SEA:"SEA", SF:"SF", SFO:"SF", TB:"TB", TAM:"TB", TEN:"TEN", WAS:"WAS", WSH:"WAS"
};
const norm = (a?: string) => (a ? (TEAM_MAP[a.toUpperCase()] ?? a.toUpperCase()) : '');

function splitCSVLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
function parseCSV(text: string): Record<string,string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row: Record<string,string> = {};
    headers.forEach((h,i)=>row[h] = (cols[i] ?? '').trim());
    return row;
  });
}
const pick = (r: any, keys: string[]) => {
  for (const k of keys) {
    const v = r[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const composeIso = (d?: any, t?: any) => {
  const dd = d ? String(d).trim() : '';
  const tt0 = t ? String(t).trim() : '';
  if (!dd || !tt0) return null;
  const tt = /^\d{2}:\d{2}$/.test(tt0) ? `${tt0}:00` : tt0;
  return `${dd}T${tt}Z`;
};
const normalizeKickoff = (row: Record<string, any>): string | null => {
  const direct = pick(row, ['kickoff','start_time','game_datetime','gamedatetime','game_time_eastern','starttime']);
  if (direct) {
    const kd = String(direct).trim();
    if (DATE_PREFIX.test(kd)) return kd;
  }
  const dateField = pick(row, ['gameday','date','game_date']);
  const timeField = pick(row, ['gametime','time','game_time','game_time_eastern']);
  const composed = composeIso(dateField, timeField);
  return composed && DATE_PREFIX.test(composed) ? composed : null;
};

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const SCHEDULE_SEASON = Number(process.env.SCHEDULE_SEASON || new Date().getUTCFullYear());
  const SCHEDULE_FEED_URL = process.env.SCHEDULE_FEED_URL
    || 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
  const SCORE_FEED_URL = process.env.SCORE_FEED_URL
    || 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // --- Import schedule (weeks + games)
  console.log(`[schedule] fetching ${SCHEDULE_FEED_URL}`);
  const res = await fetch(SCHEDULE_FEED_URL, { cache: 'no-store' });
  const csv = await res.text();
  if (!res.ok) throw new Error(`schedule feed ${res.status}`);

  const rows = parseCSV(csv);
  const sched: {season:number; week:number; home:string; away:string; kickoff:string|null}[] = [];
  for (const r of rows) {
    const season = Number(pick(r, ['season','year']));
    if (!Number.isFinite(season) || season !== SCHEDULE_SEASON) continue;
    const week = Number(pick(r, ['week','game_week']));
    const home = norm(String(pick(r, ['home_team','home','team_home','team_h']) ?? ''));
    const away = norm(String(pick(r, ['away_team','away','team_away','team_a']) ?? ''));
    if (!Number.isFinite(week) || !home || !away) continue;
    const kickoff = normalizeKickoff(r);
    sched.push({ season, week, home, away, kickoff });
  }
  console.log(`[schedule] normalized rows: ${sched.length}`);

  // upsert weeks
  const weeksMap = new Map<string, {season:number; week:number; starts_on:string|null}>();
  for (const r of sched) {
    const key = `${r.season}-${r.week}`;
    if (!weeksMap.has(key)) {
      const k = r.kickoff ?? '';
      weeksMap.set(key, { season: r.season, week: r.week, starts_on: DATE_PREFIX.test(k) ? k.slice(0,10) : null });
    }
  }
  const weeks = Array.from(weeksMap.values());
  if (weeks.length) {
    const w = await supabase.from('weeks').upsert(weeks, { onConflict: 'season,week' });
    if (w.error) throw w.error;
  }
  // upsert games
  let gamesCount = 0;
  for (const r of sched) {
    const g = await supabase.from('games').upsert(
      { season: r.season, week: r.week, home: r.home, away: r.away, kickoff: r.kickoff, is_tiebreaker: false },
      { onConflict: 'season,week,home,away' }
    );
    if (g.error) throw g.error;
    gamesCount++;
  }
  console.log(`[schedule] upserted games: ${gamesCount}`);

  // auto tiebreaker exactly one per week
  const { data: weekRows, error: wErr } = await supabase
    .from('weeks')
    .select('week')
    .eq('season', SCHEDULE_SEASON)
    .order('week');
  if (wErr) throw wErr;

  for (const w of weekRows ?? []) {
    const wk = Number((w as any).week);
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('season', SCHEDULE_SEASON)
      .eq('week', wk)
      .eq('is_tiebreaker', true)
      .limit(1);
    if (existing?.length) continue;

    const { data: candidates, error: cErr } = await supabase
      .from('games')
      .select('id,kickoff')
      .eq('season', SCHEDULE_SEASON)
      .eq('week', wk);
    if (cErr) throw cErr;
    if (!candidates?.length) continue;

    const withTime = candidates.filter(g => !!(g as any).kickoff);
    const pool = withTime.length ? withTime : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)] as any;

    await supabase.from('games').update({ is_tiebreaker: false }).eq('season', SCHEDULE_SEASON).eq('week', wk);
    await supabase.from('games').update({ is_tiebreaker: true }).eq('id', pick.id);
  }
  console.log('[tiebreaker] set one per week');

  // --- Backfill scores
  console.log(`[scores] fetching ${SCORE_FEED_URL}`);
  const res2 = await fetch(SCORE_FEED_URL, { cache: 'no-store' });
  const csv2 = await res2.text();
  if (!res2.ok) throw new Error(`score feed ${res2.status}`);
  const rows2 = parseCSV(csv2);

  type Up = { season:number; week:number; home:string; away:string; hs:number; as:number; winner:string|null };
  const ups: Up[] = [];
  for (const r of rows2) {
    const season = Number(pick(r, ['season','year']));
    if (!Number.isFinite(season) || season !== SCHEDULE_SEASON) continue;
    const week = Number(pick(r, ['week','game_week']));
    const home = norm(String(pick(r, ['home_team','home'])));
    const away = norm(String(pick(r, ['away_team','away'])));
    const hs = Number(pick(r, ['home_score','home_pts','home_points','home_score_total']));
    const as = Number(pick(r, ['away_score','away_pts','away_points','away_score_total']));
    if (!Number.isFinite(week) || !home || !away || !Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const winner = hs > as ? 'HOME' : hs < as ? 'AWAY' : null;
    ups.push({ season, week, home, away, hs, as, winner });
  }
  console.log(`[scores] candidate updates: ${ups.length}`);

  for (const u of ups) {
    const patch: any = { home_score: u.hs, away_score: u.as };
    if (u.winner !== null) patch.winner = u.winner;
    const resp = await supabase
      .from('games')
      .update(patch)
      .eq('season', u.season)
      .eq('week', u.week)
      .eq('home', u.home)
      .eq('away', u.away);
    if (resp.error) throw resp.error;
  }
  console.log('[scores] applied updates');

  console.log('✅ Backfill complete.');
}

main().catch((e) => {
  console.error('❌ Backfill failed:', e?.message || e);
  process.exit(1);
});
