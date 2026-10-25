// Акційна ціна товару. Акція діє в межах дат (valid_from…valid_until) і, якщо задано,
// лише в щоденне вікно за київським часом (напр. «щодня до 16:00» — після 16:00 звичайна ціна).
// Спільне для сайту (ціни перераховуються наживо, без перезавантаження) і /api/order (авторитетна ціна).

import { kyivNow } from "@/lib/kyivTime";
import type { Product } from "@/lib/types";

export interface PromoRule {
  price: number;
  /** межі дат (ISO); null — без обмеження */
  from: string | null;
  until: string | null;
  /** щоденне вікно у хвилинах від опівночі (Київ); null — без обмеження з цього боку */
  dailyFrom: number | null;
  dailyTo: number | null;
}

/** «16:00» / «16:00:00» (postgres time) → 960; порожнє/некоректне → null. */
export function timeToMinutes(v: string | null | undefined): number | null {
  const m = (v ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 960 → «16:00». */
export function minutesToTime(n: number | null): string {
  if (n == null) return "";
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

export function isPromoActive(r: PromoRule, at: Date): boolean {
  const t = at.getTime();
  if (r.from && new Date(r.from).getTime() > t) return false;
  if (r.until && new Date(r.until).getTime() < t) return false;
  if (r.dailyFrom == null && r.dailyTo == null) return true;
  const m = kyivNow(at).minutes;
  const from = r.dailyFrom ?? 0;
  const to = r.dailyTo ?? 24 * 60;
  // вікно через північ (напр. 22:00–02:00)
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

/** Найвигідніша діюча акція, нижча за каталожну ціну; null — акції зараз немає. */
export function activePromo(rules: PromoRule[] | undefined, basePrice: number, at: Date): PromoRule | null {
  let best: PromoRule | null = null;
  for (const r of rules ?? []) {
    if (r.price > 0 && r.price < basePrice && isPromoActive(r, at) && (!best || r.price < best.price)) best = r;
  }
  return best;
}

/** Каталог з цінами «на зараз»: діюча акція → price = акційна, oldPrice = звичайна. */
export function withPromoPrices(catalog: Product[], at: Date): Product[] {
  return catalog.map((p) => {
    const pr = activePromo(p.promoRules, p.price, at);
    return pr ? { ...p, oldPrice: p.price, price: pr.price, ...(pr.until ? { promoUntil: pr.until } : {}) } : p;
  });
}

/** Відбиток діючих акцій — змінюється лише тоді, коли якась акція почалась або скінчилась. */
export function promoStateKey(catalog: Product[], at: Date): string {
  let key = "";
  for (const p of catalog) {
    if (!p.promoRules?.length) continue;
    const pr = activePromo(p.promoRules, p.price, at);
    if (pr) key += `${p.id}:${pr.price};`;
  }
  return key;
}
