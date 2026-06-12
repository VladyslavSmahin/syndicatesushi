import type { NavCategory } from "@/lib/types";

// Закріплені спец-пункти навігації (не категорії товарів).
// Самі пункти фіксовані (як сутності не зникають), у БД (settings, key='nav_specials')
// зберігається лише їх видимість у навігації.
export const NAV_SPECIALS: NavCategory[] = [
  { id: "novynky", label: "Новинки", filter: { badge: "НОВЕ" } },
  { id: "aktsii", label: "Акції", scrollTo: "hero" },
];

/** Парс jsonb-видимості; за замовчуванням пункт видимий. */
export function parseNavVisibility(v: unknown): Record<string, boolean> {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const sp of NAV_SPECIALS) out[sp.id] = o[sp.id] !== false;
  return out;
}
