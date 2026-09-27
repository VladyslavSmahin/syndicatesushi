// Час закладу: усе, що стосується «сьогодні», поточного часу й слотів самовивозу,
// рахуємо в Europe/Kyiv — і на клієнті, і на сервері. Інакше телефон з іншим
// часовим поясом (або сервер в UTC) бачив би інший «сьогодні» й інші слоти.
// Спільне для PickupPicker, CartDrawer і /api/order.

export const KYIV_TZ = "Europe/Kyiv";

export const PICKUP_DAYS_AHEAD = 7; // на скільки днів наперед можна замовити (включно з сьогодні)
export const PICKUP_STEP_MIN = 15;  // крок часу
export const PICKUP_LEAD_MIN = 30;  // мінімальний запас часу на приготування

const pad = (n: number) => String(n).padStart(2, "0");

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: KYIV_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Поточна дата (YYYY-MM-DD) і хвилини від опівночі — за київським часом. */
export function kyivNow(at: Date = new Date()): { date: string; minutes: number } {
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) parts[p.type] = p.value;
  const hour = Number(parts.hour) % 24; // деякі рушії віддають «24» опівночі
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute) };
}

/** «2026-08-30» + n днів → «2026-09-01» (календарна арифметика, без часових поясів). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Підпис дня «нд, 31.08» для дати YYYY-MM-DD. */
export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("uk-UA", {
    timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit",
  });
}

/** «11:00 — 22:00» → [660, 1320] у хвилинах від опівночі. */
export function parseHours(hours: string): [number, number] {
  const m = (hours || "").match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return [10 * 60, 22 * 60];
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Слоти часу для дня в межах годин роботи; на сьогодні — лише майбутні (із запасом на приготування). */
export function timeSlots(dateValue: string, hours: string, now = kyivNow()): string[] {
  const [open, close] = parseHours(hours);
  if (dateValue < now.date) return [];
  let from = open;
  if (dateValue === now.date) {
    const earliest = now.minutes + PICKUP_LEAD_MIN;
    from = Math.max(open, Math.ceil(earliest / PICKUP_STEP_MIN) * PICKUP_STEP_MIN);
  }
  const out: string[] = [];
  for (let t = from; t <= close - PICKUP_STEP_MIN; t += PICKUP_STEP_MIN) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

export interface DayOption { value: string; label: string; }

/** Найближчі дні, на які є вільні слоти: Сьогодні / Завтра / «нд, 31.08».
 *  Сьогодні після закриття не пропонуємо (навіть «по готовності»). */
export function dayOptions(hours: string, now = kyivNow()): DayOption[] {
  const out: DayOption[] = [];
  for (let i = 0; i < PICKUP_DAYS_AHEAD; i++) {
    const value = addDays(now.date, i);
    if (!timeSlots(value, hours, now).length) continue;
    const label = i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : weekdayLabel(value);
    out.push({ value, label });
  }
  return out;
}

/** Перший день, на який можна замовити самовивіз (сьогодні або, якщо вже зачинено, — наступний). */
export function firstPickupDay(hours: string, now = kyivNow()): string {
  return dayOptions(hours, now)[0]?.value ?? addDays(now.date, 1);
}

/** Чи досі актуальний вибір самовивозу: день не в минулому, має слоти, а конкретний час ще не минув. */
export function isPickupStillValid(date: string, time: string, hours: string, now = kyivNow()): boolean {
  if (!dayOptions(hours, now).some((d) => d.value === date)) return false;
  return !time || timeSlots(date, hours, now).includes(time);
}
