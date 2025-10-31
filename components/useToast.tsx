"use client";

import { useEffect, useState } from "react";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message } }));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string };
      setMsg(detail?.message ?? "");
      const t = setTimeout(() => setMsg(null), 2600);
      return () => clearTimeout(t);
    };
    window.addEventListener("app:toast", handler as EventListener);
    return () => window.removeEventListener("app:toast", handler as EventListener);
  }, []);

  if (!msg) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2 shadow-lg">
        <span className="text-sm">{msg}</span>
      </div>
    </div>
  );
}
