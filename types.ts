export type League = { id: string; name: string; code: string; owner_id: string };
export type Game = {
  id: string;
  season: number;
  week: number;
  home: string;
  away: string;
  kickoff: string | null;
  home_score?: number | null;
  away_score?: number | null;
  winner: 'HOME'|'AWAY'|null;
  is_tiebreaker?: boolean | null;
};
export type Pick = { id: string; league_id: string; user_id: string; game_id: string; pick: 'HOME'|'AWAY' };
