"use client";

import type { NavCategory } from "@/lib/types";

/**
 * Повернення «назад» на головну в той самий стан: категорія, фільтри, сортування,
 * скільки товарів підвантажено, вкладка «Новинки/Хіти», позиція скролу, відкрита картка.
 *
 * Стан пишемо в sessionStorage (живе в межах вкладки), а відновлюємо ЛИШЕ при поверненні
 * назад (popstate або back_forward-завантаження) — перехід по лого/посиланню відкриває
 * головну «з нуля».
 */

type NavFilter = NonNullable<NavCategory["filter"]>;

export type HomeSnapshot = {
  navFilter?: NavFilter | null;
  selected?: string[];
  selectedSub?: string | null;
  sort?: string;
  visibleCount?: number;
  hitsTab?: number;
  scrollY?: number;
  /** id товарів списку, з якого відкрили модалку (для свайпу після повернення) */
  modalList?: string[];
};

const KEY = "home-state";

/** Ключ у history.state, під яким лежить slug відкритої модалки товару. */
export const MODAL_STATE_KEY = "ssModal";
/** Ключ у history.state: id товарів списку, з якого відкрили модалку (свій у кожного кроку історії). */
export const MODAL_LIST_KEY = "ssList";
/** Ключ у history.state: цей крок історії відкрито переходом усередині сайту. */
const IN_APP_STATE_KEY = "ssInApp";

export function saveHomeState(patch: HomeSnapshot) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    sessionStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }));
  } catch { /* сховище недоступне — просто не відновимо */ }
}

function readHomeState(): HomeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---- чи прийшли на сторінку кнопкою «назад» ----

// шлях, на який привів останній popstate (null — останній перехід був звичайним)
let pendingPopPath: string | null = null;

// останній перехід був кнопкою «назад/вперед» (читає й скидає NavTracker)
let lastNavWasPop = false;
export function consumePopNavigation(): boolean {
  const v = lastNavWasPop;
  lastNavWasPop = false;
  return v;
}

// шлях, з яким завантажився документ: back_forward-відновлення — лише якщо це була головна
let initialPath: string | null = null;
let homeMountedInDoc = false;

if (typeof window !== "undefined") {
  initialPath = window.location.pathname;
  // слухач реєструється раніше за будь-яку сторінку (модуль імпортує NavTracker у layout)
  window.addEventListener("popstate", () => { pendingPopPath = window.location.pathname; lastNavWasPop = true; });
}

/** Скидає ознаку popstate — викликають сторінки, що обробили його самі (напр. закриття модалки). */
export function clearPendingPop() {
  pendingPopPath = null;
  lastNavWasPop = false; // шлях не змінився — NavTracker цей popstate не побачить
}

// відновлювати стан — один раз на монтування головної
let restoreSnapshot: HomeSnapshot | null = null;
let restoring = false;

/**
 * Викликається при монтуванні головної: якщо прийшли «назад» — повертає збережений стан
 * і вмикає режим відновлення (ефекти-скидання фільтрів у цей час мають мовчати).
 */
export function beginHomeRestore(): HomeSnapshot | null {
  // ідемпотентно: React (strict mode) може викликати ініціалізатор двічі
  if (restoring) return restoreSnapshot;
  const byPop = pendingPopPath === window.location.pathname;
  pendingPopPath = null;
  let byReload = false;
  // back_forward стосується всього документа: рахуємо лише перше монтування головної,
  // і лише якщо документ завантажено саме на головній (а не на /menu/x → клік по лого)
  const firstHomeMount = !homeMountedInDoc && initialPath === window.location.pathname;
  homeMountedInDoc = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    byReload = firstHomeMount && nav?.type === "back_forward";
  } catch { /* ignore */ }
  if (!byPop && !byReload) {
    // звичайний захід на головну — старий знімок більше не актуальний
    restoreSnapshot = null;
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
  restoreSnapshot = readHomeState();
  restoring = !!restoreSnapshot;
  return restoreSnapshot;
}

/** Збережений стан, який зараз відновлюється (для дочірніх компонентів головної). */
export function peekHomeRestore(): HomeSnapshot | null {
  return restoring ? restoreSnapshot : null;
}

export function isHomeRestoring() {
  return restoring;
}

export function endHomeRestore() {
  restoring = false;
  restoreSnapshot = null;
}

// завершення відновлення з затримкою; повторний старт (strict mode монтує ефекти двічі) його скасовує
let endTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleEndHomeRestore(ms: number) {
  clearTimeout(endTimer);
  endTimer = setTimeout(endHomeRestore, ms);
}
export function cancelEndHomeRestore() {
  clearTimeout(endTimer);
}

// ---- чи є куди повертатися в межах сайту ----

/** Позначає ПОТОЧНИЙ крок історії як відкритий зсередини сайту (прапорець живе в history.state). */
export function markInAppNavigation() {
  const st = window.history.state ?? {};
  if (!st[IN_APP_STATE_KEY]) window.history.replaceState({ ...st, [IN_APP_STATE_KEY]: true }, "");
}

/** Чи є попередній крок у межах сайту (інакше «назад» вивів би на Google/інший сайт). */
export function hasInAppHistory(): boolean {
  return window.history.state?.[IN_APP_STATE_KEY] === true;
}
