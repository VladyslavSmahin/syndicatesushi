"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PWA: сайт і адмінка ставляться на екран «Додому» як застосунки.
 *
 * iPhone/iPad, установлений застосунок: звичайний перехід на Google відкриває вхід у шторці
 * Safari з окремим сховищем — сесія до застосунку не доходить. Apple для OAuth радить window.open:
 * таке вікно лишається в межах веб-застосунку (WWDC23 «What's new in web apps»). Вікно відкриваємо
 * одразу в тому ж натисканні, інакше iOS його заблокує.
 */

/** Сайт відкрито як установлений застосунок (а не у вкладці браузера). */
export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad (включно з iPad, що представляється Mac'ом). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const POPUP_NAME = "ss-google-signin";
const callbackUrl = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

/**
 * Вхід через Google; після нього — на next. У застосунку на iPhone — через вікно window.open:
 * callback завершує вхід на /auth/popup-done (закриває вікно), а тут ми чекаємо, поки зʼявиться
 * сесія (cookie спільні), і переходимо на next.
 */
export async function signInWithGoogle(supabase: SupabaseClient, next: string) {
  if (!(isIos() && isStandalone())) {
    return supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
  }
  const popup = window.open("about:blank", POPUP_NAME);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(`/auth/popup-done?next=${encodeURIComponent(next)}`), skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    popup?.close();
    return { data, error };
  }
  if (!popup) {
    window.location.assign(data.url);
    return { data, error };
  }
  popup.location.href = data.url;
  waitForSession(supabase, next);
  return { data, error };
}

/** Чекаємо сесію, поки людина входить у вікні Google (до 10 хв), і переходимо на next. */
function waitForSession(supabase: SupabaseClient, next: string) {
  const started = Date.now();
  const check = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      cleanup();
      window.location.assign(next);
    } else if (Date.now() - started > 10 * 60_000) {
      cleanup();
    }
  };
  const timer = window.setInterval(check, 1500);
  const onVisible = () => { if (document.visibilityState === "visible") void check(); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  function cleanup() {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  }
}
