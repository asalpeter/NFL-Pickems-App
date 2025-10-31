import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the most sensible "current" week number:
 * - the smallest week with kickoff > now, or
 * - if all are in the past, the largest week that exists
 */
export async function computeDefaultWeek(
  supabase: SupabaseClient,
  season: number
): Promise<number> {
  const { data, error } = await supabase
    .from("games")
    .select("week, kickoff")
    .eq("season", season)
    .order("kickoff", { ascending: true });

  if (error || !data?.length) return 1;

  const now = Date.now();
  const weeks = data.reduce<Record<number, Date[]>>((acc, g: any) => {
    const w = g.week as number;
    const k = g.kickoff ? new Date(g.kickoff) : null;
    if (!k) return acc;
    (acc[w] ||= []).push(k);
    return acc;
  }, {});

  const sortedWeeks = Object.keys(weeks).map(Number).sort((a, b) => a - b);
  for (const w of sortedWeeks) {
    const earliest = weeks[w].sort((a, b) => +a - +b)[0];
    if (+earliest > now) return w;
  }
  return sortedWeeks[sortedWeeks.length - 1] ?? 1;
}
