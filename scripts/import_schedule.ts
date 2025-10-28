/**
 * Import schedule from a CSV with headers:
 * season,week,kickoff,home,away,is_tiebreaker
 * kickoff in ISO8601 UTC (e.g., 2025-09-07T20:25:00Z)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

function parseCSV(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map(h=>h.trim());
  return lines.map(line => {
    const cols = line.split(",").map(c=>c.trim());
    const row: any = {};
    headers.forEach((h,i)=> row[h] = cols[i]);
    return row;
  });
}

async function main() {
  const file = process.argv[2] || path.join(process.cwd(), "data", "sample_schedule.csv");
  const csv = fs.readFileSync(file, "utf-8");
  const rows = parseCSV(csv);
  const weeks = new Map<string, {season:number, week:number, starts_on:string}>();
  for (const r of rows) {
    const season = Number(r.season);
    const week = Number(r.week);
    const kickoff = r.kickoff;
    weeks.set(`${season}-${week}`, { season, week, starts_on: kickoff.slice(0,10) });
  }
  await supabase.from('weeks').upsert(Array.from(weeks.values()), { onConflict: 'season,week' });
  for (const r of rows) {
    const season = Number(r.season);
    const week = Number(r.week);
    const kickoff = r.kickoff || null;
    const home = r.home;
    const away = r.away;
    const is_tiebreaker = String(r.is_tiebreaker||'').toLowerCase() === 'true';
    const { error } = await supabase.from('games').upsert({
      season, week, kickoff, home, away, is_tiebreaker
    }, { onConflict: 'season,week,home,away' });
    if (error) throw error;
  }
  console.log(`Imported ${rows.length} games.`);
}

main().catch(e => { console.error(e); process.exit(1); });
