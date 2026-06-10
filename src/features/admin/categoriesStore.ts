"use client";

// ДЕМО-сховище категорій на localStorage з підпискою.
// Призначення: показати, що категорія, додана в адмінці, одразу зʼявляється
// в навігації сайту. На етапі Supabase це замінять запити до таблиці `categories`.

import { useSyncExternalStore, useMemo } from "react";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  showInNav: boolean;
  isActive: boolean;
}

const KEY = "ss_categories_v1";
const EVT = "ss_categories_changed";

// базові категорії (відповідають даним прототипу)
const DEFAULTS: Category[] = [
  { id: "sety", name: "Сети", slug: "сети", sortOrder: 10, showInNav: true, isActive: true },
  { id: "roly", name: "Роли", slug: "роли", sortOrder: 20, showInNav: true, isActive: true },
  { id: "vok", name: "Вок", slug: "вок", sortOrder: 30, showInNav: true, isActive: true },
  { id: "sousy", name: "Соуси", slug: "соуси", sortOrder: 40, showInNav: true, isActive: true },
  { id: "supy", name: "Супи", slug: "супи", sortOrder: 50, showInNav: true, isActive: true },
  { id: "burito", name: "Суш-буріто", slug: "буріто", sortOrder: 60, showInNav: true, isActive: true },
];

const SERVER_SNAPSHOT: Category[] = []; // стабільне порожнє значення для SSR

function sortCopy(list: Category[]): Category[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
}

function readFromStorage(): Category[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sortCopy(JSON.parse(raw) as Category[]) : sortCopy(DEFAULTS);
  } catch {
    return sortCopy(DEFAULTS);
  }
}

// КЕШОВАНИЙ снапшот — стабільна посилання між рендерами (вимога useSyncExternalStore).
// Оновлюється лише при записі або зовнішній зміні (storage event з іншої вкладки).
let current: Category[] = typeof window === "undefined" ? SERVER_SNAPSHOT : readFromStorage();

function persistAndNotify() {
  localStorage.setItem(KEY, JSON.stringify(current));
  window.dispatchEvent(new Event(EVT));
}

function setCurrent(list: Category[]) {
  current = sortCopy(list);
}

export const categoriesStore = {
  list(): Category[] {
    return current; // та сама посилання, поки не було змін
  },
  add(input: Omit<Category, "id">): Category {
    const cat: Category = { ...input, id: crypto.randomUUID() };
    setCurrent([...current, cat]);
    persistAndNotify();
    return cat;
  },
  update(id: string, patch: Partial<Category>) {
    setCurrent(current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    persistAndNotify();
  },
  remove(id: string) {
    setCurrent(current.filter((c) => c.id !== id));
    persistAndNotify();
  },
  reset() {
    setCurrent(DEFAULTS);
    persistAndNotify();
  },
};

// ---- React-підписка ----
function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = () => {
    // зміна з іншої вкладки → перечитуємо й оновлюємо посилання
    current = readFromStorage();
    cb();
  };
  window.addEventListener(EVT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCategories(opts?: { navOnly?: boolean }): Category[] {
  const cats = useSyncExternalStore(
    subscribe,
    categoriesStore.list, // повертає стабільну посилання `current`
    () => SERVER_SNAPSHOT
  );
  // фільтрацію робимо тут через useMemo — нова посилання лише коли змінився `cats`
  return useMemo(
    () => (opts?.navOnly ? cats.filter((c) => c.isActive && c.showInNav) : cats),
    [cats, opts?.navOnly]
  );
}
