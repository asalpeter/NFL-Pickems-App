"use client";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { League, Game, Pick } from "@/types";

type Profile = { id: string; username: string | null };

export default function Dashboard() {
  const supabase = getBrowserSupabase();
  const [profile, setProfile] = useState<Profile|null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!prof) await supabase.from('profiles').insert({ id: user.id, username: user.email?.split('@')[0] });
      setProfile(prof || { id: user.id, username: user.email?.split('@')[0] || null });
      const { data } = await supabase
        .from('league_members')
        .select('leagues(*) , league_id')
        .eq('user_id', user.id);
      setLeagues((data||[]).map((d:any)=>d.leagues));
    })();
  }, []);

  const createLeague = async () => {
    const name = prompt("League name?");
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // create league
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const { data, error } = await supabase.from('leagues').insert({ owner_id: user.id, name, code }).select().single();
    if (error) return alert(error.message);
    // add self as member
    await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id, is_admin: true });
    setLeagues(l => [data as League, ...l]);
  };

  const joinLeague = async () => {
    if (!joinCode) return;
    const { data: league } = await supabase.from('leagues').select('*').eq('code', joinCode.toUpperCase()).maybeSingle();
    if (!league) return alert("League not found");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('league_members').insert({ league_id: league.id, user_id: user.id });
    if (error) return alert(error.message);
    setLeagues(l => [league as League, ...l]);
    setJoinCode("");
  };

  return (
    <div className="grid gap-6">
      <div className="card flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <h1>Dashboard</h1>
          <p className="text-slate-300">Welcome {profile?.username ?? "friend"}.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn" onClick={createLeague}>➕ Create League</button>
          <input className="input" placeholder="Join code" value={joinCode} onChange={e=>setJoinCode(e.target.value)} />
          <button className="btn" onClick={joinLeague}>Join</button>
        </div>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        {leagues.length===0 ? (
          <div className="card"><p>No leagues yet. Create one above!</p></div>
        ) : leagues.map(l => (
          <div key={l.id} className="card flex items-center justify-between">
            <div>
              <h3>{l.name}</h3>
              <p className="text-slate-400 text-sm mt-1">Invite with code <span className="font-mono">{l.code}</span></p>
            </div>
            <Link className="btn" href={`/league/${l.id}`}>Open</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
