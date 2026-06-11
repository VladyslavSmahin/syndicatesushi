// Розрахунок вартості доставки за адресою.
// Налаштування зберігаються в Supabase (settings, key='delivery') і редагуються в адмінці.

export interface DeliverySettings {
  /** координати закладу (звідки рахуємо відстань) */
  originLat: number;
  originLng: number;
  /** базова ціна за базову відстань */
  basePrice: number;
  /** км, що входять у базову ціну */
  baseKm: number;
  /** доплата за кожен наступний крок */
  stepPrice: number;
  /** км у кроці */
  stepKm: number;
  /** безкоштовна доставка від суми замовлення (null = вимкнено) */
  freeFrom: number | null;
  /** максимальна відстань доставки, км (null = без обмеження) */
  maxKm: number | null;
}

export const DEFAULT_DELIVERY: DeliverySettings = {
  originLat: 48.6756,
  originLng: 28.8486,
  basePrice: 100,
  baseKm: 2,
  stepPrice: 20,
  stepKm: 5,
  freeFrom: null,
  maxKm: null,
};

const ROAD_FACTOR = 1.3; // коефіцієнт «по дорозі» від прямої відстані

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface DeliveryQuote {
  km: number;        // орієнтовна відстань по дорозі
  price: number;     // вартість доставки
  free: boolean;     // безкоштовно (за сумою замовлення)
  outOfRange: boolean; // поза зоною доставки (maxKm)
}

export function quoteDelivery(s: DeliverySettings, destLat: number, destLng: number, subtotal: number): DeliveryQuote {
  const km = Math.round(haversineKm(s.originLat, s.originLng, destLat, destLng) * ROAD_FACTOR * 10) / 10;
  const outOfRange = s.maxKm != null && km > s.maxKm;
  const free = s.freeFrom != null && subtotal >= s.freeFrom;

  let price = 0;
  if (!free) {
    price = s.basePrice;
    if (km > s.baseKm) price += Math.ceil((km - s.baseKm) / s.stepKm) * s.stepPrice;
  }
  return { km, price, free, outOfRange };
}

/** Безпечний парс jsonb-налаштувань із БД у DeliverySettings. */
export function parseDeliverySettings(v: unknown): DeliverySettings {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const num = (x: unknown, d: number) => (typeof x === "number" && isFinite(x) ? x : d);
  const numOrNull = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : null);
  return {
    originLat: num(o.originLat, DEFAULT_DELIVERY.originLat),
    originLng: num(o.originLng, DEFAULT_DELIVERY.originLng),
    basePrice: num(o.basePrice, DEFAULT_DELIVERY.basePrice),
    baseKm: num(o.baseKm, DEFAULT_DELIVERY.baseKm),
    stepPrice: num(o.stepPrice, DEFAULT_DELIVERY.stepPrice),
    stepKm: num(o.stepKm, DEFAULT_DELIVERY.stepKm),
    freeFrom: o.freeFrom == null ? null : numOrNull(o.freeFrom),
    maxKm: o.maxKm == null ? null : numOrNull(o.maxKm),
  };
}
