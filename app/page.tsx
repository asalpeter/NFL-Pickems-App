import Link from "next/link";

export default function Home() {
  return (
    <div className="grid gap-8">
      <section className="card">
        <h1>Run a weekly NFL Pick'em with friends</h1>
        <p className="mt-3 text-slate-300">
          Create a private league, invite friends, make weekly picks, and track standings.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="btn" href="/auth">Get started</Link>
          <Link className="btn" href="/dashboard">Go to dashboard</Link>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-6">
        {[
          ["Create leagues", "Spin up a private league in seconds."],
          ["Invite friends", "Share a code or link to join."],
          ["Make weekly picks", "Pick winners for every game."],
        ].map(([t,d]) => (
          <div key={t} className="card">
            <h3>{t}</h3>
            <p className="text-slate-300 mt-2">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
