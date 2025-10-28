import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "NFL Pick'ems",
  description: "Weekly NFL pick'em leagues with friends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-800">
          <div className="container py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">🏈 Pick'ems</Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/dashboard" className="link">Dashboard</Link>
              <Link href="/auth" className="link">Sign in</Link>
              <a href="https://github.com/" target="_blank" className="link">GitHub</a>
            </nav>
          </div>
        </header>
        <main className="container py-8">{children}</main>
      </body>
    </html>
  );
}
