"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function OnboardingPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/auth");
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.username) return router.replace("/");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setErr(null);
    const uname = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
      setErr("Username must be 3–20 chars (letters, numbers, underscore).");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setErr("Please sign in again.");

    const { error } = await supabase
      .from("profiles")
      .update({ username: uname })
      .eq("id", user.id);

    if (error) {
      if ((error as any).code === "23505") setErr("That username is taken.");
      else setErr(error.message);
      return;
    }
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-6 card">
        <p className="text-slate-300">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 card">
      <h1 className="text-xl mb-2">Choose your username</h1>
      <p className="text-slate-400 mb-4 text-sm">
        This is how friends will see you in leagues and leaderboards.
      </p>
      <div className="grid gap-3">
        <input
          className="input"
          placeholder="e.g., eldod_"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
        />
        <button className="btn" onClick={save}>Save</button>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </div>
  );
}
