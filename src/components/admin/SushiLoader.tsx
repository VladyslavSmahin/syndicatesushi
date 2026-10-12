"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Скільки запитів (fetch) зараз «в польоті» — рахуємо, обгорнувши window.fetch один раз на вкладку.
// Supabase-клієнт і наші /api/* ходять через fetch, тож лоадер бачить усі звернення до бази й сервера.
let inFlight = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function installFetchTracker() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __ssFetchTracked?: boolean };
  if (w.__ssFetchTracked) return;
  w.__ssFetchTracked = true;
  const orig = window.fetch.bind(window);
  window.fetch = (async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0] instanceof Request ? args[0].url : args[0]);
    // службові запити Next (HMR, RSC-префетч, аналітика) — не показуємо
    const quiet = /_next\/|__nextjs|webpack-hmr|\/_vercel\//.test(url);
    if (!quiet) { inFlight++; emit(); }
    try { return await orig(...args); }
    finally { if (!quiet) { inFlight--; emit(); } }
  }) as typeof fetch;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const useInFlight = () => useSyncExternalStore(subscribe, () => inFlight, () => 0);

/** Суші-лоадер у шапці адмінки: ролик-маки крутиться, поки йде запит або перехід між розділами.
 *  Зʼявляється з затримкою 250 мс (щоб не блимав на швидких запитах) і тримається мінімум 400 мс. */
export default function SushiLoader({ navigating = false }: { navigating?: boolean }) {
  useEffect(() => { installFetchTracker(); }, []);
  const busy = useInFlight() > 0 || navigating;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (busy) { const t = setTimeout(() => setShown(true), 250); return () => clearTimeout(t); }
    const t = setTimeout(() => setShown(false), 400);
    return () => clearTimeout(t);
  }, [busy]);

  return (
    <span className={`sushi-loader${shown ? " on" : ""}`} role="status" aria-live="polite" aria-label={shown ? "Завантаження…" : undefined}>
      <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden>
        <g className="sushi-loader-roll">
          <circle cx="20" cy="20" r="17" fill="#1d2a1f" stroke="#0e1510" strokeWidth="2" />
          <circle cx="20" cy="20" r="13" fill="#f4efe6" />
          <circle cx="13.5" cy="15" r="1" fill="#d9cfbf" />
          <circle cx="26" cy="13.5" r="1" fill="#d9cfbf" />
          <circle cx="27.5" cy="25" r="1" fill="#d9cfbf" />
          <circle cx="12.5" cy="25.5" r="1" fill="#d9cfbf" />
          <path d="M20 12.5 a7.5 7.5 0 0 1 6.5 11.25 L20 20 Z" fill="#f08a5d" />
          <path d="M20 20 L13.5 23.75 a7.5 7.5 0 0 1 6.5 -11.25 Z" fill="#7fb069" />
          <path d="M20 20 L26.5 23.75 a7.5 7.5 0 0 1 -13 0 Z" fill="#f7c873" />
          <circle cx="20" cy="20" r="2" fill="#f4efe6" />
        </g>
      </svg>
    </span>
  );
}
