import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const games = [
  { week: 1, home: "KC", away: "BAL", kickoff: "2025-09-04T20:20:00Z" },
  { week: 1, home: "BUF", away: "NE",  kickoff: "2025-09-07T17:00:00Z" },
  { week: 1, home: "PHI", away: "DAL", kickoff: "2025-09-07T20:25:00Z" },
  { week: 1, home: "SF",  away: "LAR", kickoff: "2025-09-07T20:25:00Z" },
];

async function main() {
  const season = 2025;
  await supabase.from('weeks').upsert(games.map(g => ({
    season, week: g.week, starts_on: g.kickoff.substring(0,10)
  })), { onConflict: 'season,week' });

  for (const g of games) {
    await supabase.from('games').upsert({
      season,
      week: g.week,
      home: g.home,
      away: g.away,
      kickoff: g.kickoff,
    }, { onConflict: 'season,week,home,away' });
  }
  console.log("Seeded mock Week 1 schedule");
}

main();
