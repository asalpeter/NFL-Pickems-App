"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

import { getBrowserSupabase } from "@/lib/supabase-browser";
import { teamLogoPath } from "@/lib/logos";
import type { Game, League } from "@/types";

type Member = {
  user_id: string;
  profiles: { id: string; username: string | null } | null;
};

type WeeklyRow = {
  user_id: string;
  wins: number;
  week_rank: number | null;
  tb_diff: number | null;
  username?: string | null; // added by /api/weekly
};

type SeasonRow = {
  user_id: string;
  wins: number;
  username?: string | null; // added by /api/standings
};

async function waitForSession(supabase: ReturnType<typeof getBrowserSupabase>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return new Promise((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (sess) {
        sub.subscription.unsubscribe();
        resolve(sess);
      }
    });
  });
}

export default function LeaguePage() {
  const supabase = getBrowserSupabase();
  const params = useParams();
  const leagueId = params?.id as string;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [week, setWeek] = useState<number>(1);
  const [season, setSeason] = useState<number>(2025);
  const [picks, setPicks] = useState<Record<string, "HOME" | "AWAY" | null>>({});
  const [tiebreakerGuess, setTiebreakerGuess] = useState<string>("");
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [seasonBoard, setSeasonBoard] = useState<SeasonRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Initial league + members + user
  useEffect(() => {
    (async () => {
      await waitForSession(supabase);

      const { data: l } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", leagueId)
        .maybeSingle();
      setLeague(l ?? null);

      const { data: rawMembers, error: mErr } = await supabase
        .from("league_members")
        .select("user_id, profiles(username,id)")
        .eq("league_id", leagueId);

      if (mErr) {
        console.warn("[league_members] select error:", mErr.message ?? mErr);
        setMembers([]);
      } else {
        const normalized: Member[] = (rawMembers ?? []).map((row: any) => ({
          user_id: row.user_id,
          profiles: Array.isArray(row.profiles)
            ? row.profiles[0] ?? null
            : row.profiles ?? null,
        }));
        setMembers(normalized);
      }

      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // Map user_id -> username for quick lookups and as a fallback
  const nameById = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const row of members) {
      const u = row.profiles?.username ?? undefined;
      if (u) m[row.user_id] = u;
    }
    return m;
  }, [members]);

  // Load games, my picks, tiebreaker, and leaderboards
  async function loadGamesAndPicks() {
    // Games for selected week/season
    const { data: g } = await supabase
      .from("games")
      .select("*")
      .eq("season", season)
      .eq("week", week)
      .order("kickoff", { ascending: true });
    setGames(g || []);

    // My picks + tiebreaker
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (g ?? []).length) {
      const { data: my } = await supabase
        .from("picks")
        .select("*")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .in("game_id", (g || []).map((x) => x.id));

      const map: Record<string, "HOME" | "AWAY" | null> = {};
      (g || []).forEach((x) => {
        map[x.id] = (my || []).find((p) => p.game_id === x.id)?.pick ?? null;
      });
      setPicks(map);

      const { data: tb } = await supabase
        .from("weekly_tiebreakers")
        .select("*")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .eq("season", season)
        .eq("week", week)
        .maybeSingle();
      if (tb?.total_points_guess != null) {
        setTiebreakerGuess(String(tb.total_points_guess));
      } else {
        setTiebreakerGuess("");
      }
    } else {
      setPicks({});
      setTiebreakerGuess("");
    }

    // Weekly (enriched with username by API)
    const res = await fetch(`/api/weekly?league_id=${leagueId}&season=${season}&week=${week}`, { cache: "no-store" });
    const w = await res.json();
    setWeekly((w?.data as WeeklyRow[]) ?? []);

    // Season standings (enriched with username by API)
    const seasonRes = await fetch(`/api/standings?league_id=${leagueId}&season=${season}`, { cache: "no-store" });
    const s = await seasonRes.json();
    setSeasonBoard((s?.data as SeasonRow[]) ?? []);
  }

  useEffect(() => {
    loadGamesAndPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, week, season]);

  // Pick setter with kickoff lock
  const setPick = async (game: Game, choice: "HOME" | "AWAY") => {
    const cutoff = game.kickoff ? new Date(game.kickoff).getTime() : 0;
    if (cutoff && Date.now() >= cutoff) {
      alert("Picks are locked for this game (kickoff passed).");
      return;
    }
    setPicks((prev) => ({ ...prev, [game.id]: choice }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Sign in");

    const { error } = await supabase
      .from("picks")
      .upsert(
        { league_id: leagueId, user_id: user.id, game_id: game.id, pick: choice },
        { onConflict: "league_id,user_id,game_id" }
      );
    if (error) alert(error.message);
  };

  // Tiebreaker save
  const saveTiebreaker = async () => {
    const val = parseInt(tiebreakerGuess);
    if (Number.isNaN(val)) return alert("Enter a number for tiebreaker.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Sign in");
    const { error } = await supabase
      .from("weekly_tiebreakers")
      .upsert({ league_id: leagueId, user_id: user.id, season, week, total_points_guess: val });
    if (error) alert(error.message);
    else alert("Saved tiebreaker guess.");
  };

  const tiebreakerGame = useMemo(() => games.find((g) => g.is_tiebreaker), [games]);
  const tiebreakerLocked = tiebreakerGame?.kickoff
    ? new Date(tiebreakerGame.kickoff).getTime() <= Date.now()
    : false;

  return (
    <div className="grid gap-6">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1>{league?.name ?? "League"}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Invite code: <span className="font-mono">{league?.code}</span>
            </p>
          </div>
          <Link className="btn" href="/dashboard">← Back</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Picks column */}
        <div className="card md:grid-cols-2 md:col-span-2">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label>Season</label>
            <select className="select" value={season} onChange={(e) => setSeason(parseInt(e.target.value))}>
              <option value={2025}>2025</option>
            </select>
            <label>Week</label>
            <select className="select" value={week} onChange={(e) => setWeek(parseInt(e.target.value))}>
              {Array.from({ length: 18 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>

          {games.length === 0 ? (
            <p className="text-slate-400">
              No games for this week yet. Make sure you’ve run the schedule import cron.
            </p>
          ) : (
            <ul className="grid gap-3">
              {games.map((g) => {
                const locked = g.kickoff ? new Date(g.kickoff).getTime() <= Date.now() : false;
                return (
                  <li key={g.id} className="border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Image src={teamLogoPath(g.away)} alt={g.away} width={56} height={32} />
                      <div className="text-slate-300 font-medium">{g.away} @ {g.home}</div>
                      <Image src={teamLogoPath(g.home)} alt={g.home} width={56} height={32} />
                      <div className="text-sm text-slate-400">
                        {g.kickoff ? format(new Date(g.kickoff), "eee, MMM d p") : null}
                      </div>
                      {g.winner && (
                        <span className="text-xs rounded-md px-2 py-1 border border-slate-700">
                          {g.winner === "HOME" ? g.home : g.away} won
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={locked}
                        className={"btn " + (picks[g.id] === "AWAY" ? "bg-slate-800" : "")}
                        onClick={() => setPick(g, "AWAY")}
                      >
                        {g.away}
                      </button>
                      <button
                        disabled={locked}
                        className={"btn " + (picks[g.id] === "HOME" ? "bg-slate-800" : "")}
                        onClick={() => setPick(g, "HOME")}
                      >
                        {g.home}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 border-t border-slate-800 pt-4">
            <h3 className="mb-2">Weekly tiebreaker</h3>
            {tiebreakerGame ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-300 text-sm">
                  Guess total points for the tiebreaker game ({tiebreakerGame.away} @ {tiebreakerGame.home}).
                </span>
                <input
                  className="input w-32"
                  placeholder="e.g., 45"
                  value={tiebreakerGuess}
                  onChange={(e) => setTiebreakerGuess(e.target.value)}
                  disabled={tiebreakerLocked}
                />
                <button className="btn" onClick={saveTiebreaker} disabled={tiebreakerLocked}>
                  {tiebreakerLocked ? "Locked" : "Save"}
                </button>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No tiebreaker game set for this week.</p>
            )}
          </div>
        </div>

        {/* Leaderboards column */}
        <div className="grid gap-6">
          <div className="card">
            <h3>Weekly leaderboard</h3>
            <ol className="mt-2 grid gap-2">
              {weekly.map((w) => (
                <li
                  key={w.user_id}
                  className={
                    "flex items-center justify-between border border-slate-800 rounded-xl p-2 " +
                    (w.week_rank === 1 ? "bg-slate-800/40" : "")
                  }
                >
                  <span>{w.username ?? nameById[w.user_id] ?? w.user_id.slice(0, 6)}</span>
                  <span className="text-slate-300">
                    {w.wins} wins {w.tb_diff != null ? `(TB Δ ${w.tb_diff})` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card">
            <h3>Season leaderboard</h3>
            <ol className="mt-2 grid gap-2">
              {seasonBoard.map((s, i) => (
                <li
                  key={s.user_id}
                  className={
                    "flex items-center justify-between border border-slate-800 rounded-xl p-2 " +
                    (i === 0 ? "bg-slate-800/40" : "")
                  }
                >
                  <span>{s.username ?? nameById[s.user_id] ?? s.user_id.slice(0, 6)}</span>
                  <span className="text-slate-300">{s.wins} wins</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
