"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

export type SortDir = "asc" | "desc";

/** Сортування таблиці кліком по заголовку колонки: перший клік — за спаданням
 *  (для чисел це «найбільші зверху»), повторний — у зворотному напрямку. */
export function useSort<T, K extends string>(
  rows: T[],
  getters: Record<K, (row: T) => number | string>,
  initial: { key: NoInfer<K>; dir?: SortDir },
) {
  const [key, setKey] = useState<K>(initial.key);
  const [dir, setDir] = useState<SortDir>(initial.dir ?? "desc");

  const sorted = useMemo(() => {
    const get = getters[key];
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      const c = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "uk");
      return c * mul;
    });
    // getters — літерал у компоненті; сортуємо при зміні рядків/ключа/напрямку
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir]);

  const toggle = (k: K) => {
    if (k === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setKey(k); setDir("desc"); }
  };

  return { sorted, key, dir, toggle };
}

/** Клікабельний заголовок колонки зі стрілкою напрямку. */
export function SortLabel({ active, dir, onClick, children, style }: {
  active: boolean; dir: SortDir; onClick: () => void; children: ReactNode; style?: CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      style={{
        background: "transparent", border: "none", padding: 0, cursor: "pointer", font: "inherit",
        letterSpacing: "inherit", textTransform: "inherit", color: active ? "var(--accent)" : "inherit",
        display: "inline-flex", alignItems: "center", gap: 4, ...style,
      }}>
      {children}
      <span aria-hidden style={{ fontSize: 9, opacity: active ? 1 : 0.35 }}>{active && dir === "asc" ? "▲" : "▼"}</span>
    </button>
  );
}
