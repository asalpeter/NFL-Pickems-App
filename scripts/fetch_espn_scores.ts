import fs from "node:fs";
import path from "node:path";

async function main() {
  const url = process.env.ESPN_SCOREBOARD_URL || "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const data = await res.json();

  const season = data?.season?.year ?? data?.leagues?.[0]?.season?.year ?? null;
  const week = data?.week?.number ?? data?.leagues?.[0]?.calendar?.current?.week ?? null;
  const rows: any[] = [];
  const events = data?.events ?? [];
  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const teams = comp?.competitors ?? [];
    const homeT = teams.find((t: any) => t?.homeAway === "home");
    const awayT = teams.find((t: any) => t?.homeAway === "away");
    const home = homeT?.team?.abbreviation || homeT?.team?.shortDisplayName || homeT?.team?.name;
    const away = awayT?.team?.abbreviation || awayT?.team?.shortDisplayName || awayT?.team?.name;
    const home_score = parseInt(homeT?.score ?? "0", 10);
    const away_score = parseInt(awayT?.score ?? "0", 10);
    if (!home || !away) continue;
    rows.push({
      season: ev?.season?.year ?? season,
      week: ev?.week?.number ?? week,
      home, away, home_score, away_score,
    });
  }

  const outPath = path.join(process.cwd(), "data", "scores.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
  console.log(`Wrote ${rows.length} rows to data/scores.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
