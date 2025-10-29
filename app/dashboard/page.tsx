"use client";

import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { League } from "@/types";

type Profile = { id: string; username: string | null };

async function waitForSession(supabase: ReturnType<typeof getBrowserSupabase>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return new Promise((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (sess) { sub.subscription.unsubscribe(); resolve(sess); }
    });
  });
}

export default function Dashboard() {
  const supabase = getBrowserSupabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    (async () => {
      await waitForSession(supabase);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure profile exists, then re-fetch to get stored username
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!prof) {
        await supabase.from("profiles").insert({
          id: user.id,
          username: user.email?.split("@")[0] ?? null,
        });
      }
      const { data: prof2 } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(prof2 ?? { id: user.id, username: user.email?.split("@")[0] ?? null });

      // Inner join to only return actual leagues tied to membership
      const { data: lm } = await supabase
        .from("league_members")
        .select("league_id, leagues!inner(*)")
        .eq("user_id", user.id);

      setLeagues((lm ?? []).map((d: any) => d.leagues));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createLeague = async () => {
    const name = prompt("League name?");
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from("leagues")
      .insert({ owner_id: user.id, name, code })
      .select()
      .single();
    if (error) return alert(error.message);

    await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id, is_admin: true });
    setLeagues((l) => [data as League, ...l]);
  };

  const joinLeague = async () => {
    if (!joinCode) return;
    const { data: league } = await supabase.from("leagues").select("*").eq("code", joinCode.toUpperCase()).maybeSingle();
    if (!league) return alert("League not found");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("league_members").insert({ league_id: league.id, user_id: user.id });
    if (error) return alert(error.message);
    setLeagues((l) => [league as League, ...l]);
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
          <input className="input" placeholder="Join code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
          <button className="btn" onClick={joinLeague}>Join</button>
        </div>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        {leagues.length === 0 ? (
          <div className="card"><p>No leagues yet. Create one above!</p></div>
        ) : leagues.map((l) => (
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
