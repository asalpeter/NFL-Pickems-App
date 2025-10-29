import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase-server";

export default async function AuthMenu() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <Link className="link" href="/auth">Sign in</Link>;

  const { data: p } = await supabase.from("profiles")
    .select("username").eq("id", user.id).maybeSingle();

  return (
    <div className="flex items-center gap-3">
      <Link className="link" href="/dashboard">{p?.username ?? "Profile"}</Link>
      {/* simple sign out */}
      <form action={async () => { const s = await getServerSupabase(); await s.auth.signOut(); }}>
        <button type="submit" className="link">Sign out</button>
      </form>
    </div>
  );
}
