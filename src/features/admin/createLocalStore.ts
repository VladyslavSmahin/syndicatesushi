"use client";

// Фабрика ДЕМО-сховища на localStorage з коректним кешуванням снапшота
// (вимога useSyncExternalStore — стабільна посилання між рендерами).
// На етапі Supabase ці сховища замінюються запитами до БД, а компоненти/форми лишаються.

import { useSyncExternalStore } from "react";

export interface Entity {
  id: string;
}

export function createLocalStore<T extends Entity>(key: string, defaults: T[]) {
  const EVT = `ss_store_${key}`;
  const SERVER: T[] = [];

  function read(): T[] {
    if (typeof window === "undefined") return SERVER;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : defaults;
    } catch {
      return defaults;
    }
  }

  // кешований снапшот — стабільна посилання
  let current: T[] = typeof window === "undefined" ? SERVER : read();

  function commit(next: T[]) {
    current = next;
    localStorage.setItem(key, JSON.stringify(current));
    window.dispatchEvent(new Event(EVT));
  }

  function subscribe(cb: () => void) {
    if (typeof window === "undefined") return () => {};
    const onLocal = () => cb();
    const onStorage = () => { current = read(); cb(); };
    window.addEventListener(EVT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }

  const store = {
    list(): T[] {
      return current;
    },
    add(item: Omit<T, "id">): T {
      const created = { ...item, id: crypto.randomUUID() } as T;
      commit([...current, created]);
      return created;
    },
    update(id: string, patch: Partial<T>) {
      commit(current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    remove(id: string) {
      commit(current.filter((it) => it.id !== id));
    },
    reset() {
      commit(defaults);
    },
    subscribe,
  };

  function useItems(): T[] {
    return useSyncExternalStore(store.subscribe, store.list, () => SERVER);
  }

  return { store, useItems };
}
