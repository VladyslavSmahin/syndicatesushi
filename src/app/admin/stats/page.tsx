"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDbCustomers, dbStatsOrders, dbFirstOrderAt, type StatsOrder } from "@/features/admin/db";
import { useIsMobile } from "@/features/useIsMobile";
import { kyivNow, addDays } from "@/lib/kyivTime";
import s from "@/components/admin/admin.module.css";
import Collapsible from "@/components/admin/Collapsible";
import RangeCalendar from "@/components/admin/RangeCalendar";

// Статистика сайту: користувачі + замовлення за обраний період (дні — за київським часом).

type Metric = "count" | "revenue";

const kyivDay = (iso: string) => kyivNow(new Date(iso)).date;
const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const money = (n: number) => `${Math.round(n).toLocaleString("uk-UA")} грн`;

const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
/** Довгий період (напр. «Весь час») — групуємо по місяцях, інакше стовпчики стають нечитабельні. */
const BY_MONTH_FROM_DAYS = 62;

// ---- Період: у кожного блоку свій (чипи + календар) ----
type PresetKey = "week" | "month" | "year" | "all" | "custom";
interface Period { key: PresetKey; from: string; to: string }
const PRESET_LABEL: Record<PresetKey, string> = { week: "Тиждень", month: "Місяць", year: "Рік", all: "Весь час", custom: "" };

function presetPeriod(key: Exclude<PresetKey, "custom">, today: string, firstDay: string | null): Period {
  const from =
    key === "week" ? addDays(today, -6)
    : key === "month" ? addDays(today, -29)
    : key === "year" ? addDays(today, -364)
    : firstDay && firstDay < today ? firstDay : today;
  return { key, from, to: today };
}
const periodTitle = (p: Period) =>
  p.key !== "custom" ? PRESET_LABEL[p.key] : `${dayLabel(p.from)}${p.from !== p.to ? ` — ${dayLabel(p.to)}` : ""}`;

/** Замовлення за період. Однаковий період у кількох блоків — один запит (кеш на 60 с). */
const ordersCache = new Map<string, { at: number; p: Promise<StatsOrder[]> }>();
function loadOrders(from: string, to: string): Promise<StatsOrder[]> {
  const key = `${from}|${to}`;
  const hit = ordersCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.p;
  // з запасом ±1 день по UTC, точний відбір — за київською датою
  const fromIso = new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString();
  const toIso = new Date(`${addDays(to, 2)}T00:00:00Z`).toISOString();
  const p = dbStatsOrders(fromIso, toIso).then((list) => list.filter((o) => { const d = kyivDay(o.createdAt); return d >= from && d <= to; }));
  ordersCache.set(key, { at: Date.now(), p });
  return p;
}
function usePeriodOrders(period: Period | null): StatsOrder[] | null {
  const [orders, setOrders] = useState<StatsOrder[] | null>(null);
  useEffect(() => {
    if (!period || period.from > period.to) return;
    let active = true;
    setOrders(null);
    loadOrders(period.from, period.to).then((list) => { if (active) setOrders(list); });
    return () => { active = false; };
  }, [period?.from, period?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  return orders;
}

function computeStats(orders: StatsOrder[], from: string, to: string) {
  const ok = orders.filter((o) => o.status !== "canceled");
  const revenue = ok.reduce((sum, o) => sum + o.total, 0);
  const phones = new Set(ok.map((o) => o.phoneNorm).filter(Boolean));
  // по днях (або по місяцях на довгому періоді) — усі проміжки, навіть без замовлень
  const days: { day: string; count: number; revenue: number }[] = [];
  let byMonth = false;
  for (let d = from, n = 0; d <= to; d = addDays(d, 1), n++) {
    if (n > BY_MONTH_FROM_DAYS) { byMonth = true; break; }
  }
  if (byMonth) {
    for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ) {
      days.push({ day: ym, count: 0, revenue: 0 });
      const [y, m] = ym.split("-").map(Number);
      ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) days.push({ day: d, count: 0, revenue: 0 });
  }
  const byKey = new Map(days.map((x) => [x.day, x]));
  for (const o of ok) {
    const d = kyivDay(o.createdAt);
    const x = byKey.get(byMonth ? d.slice(0, 7) : d);
    if (x) { x.count++; x.revenue += o.total; }
  }
  const top = new Map<string, { qty: number; sum: number }>();
  // «Додатково» (васабі, палички, імбир, соуси) у топі не показуємо — це не страви
  for (const o of ok) for (const it of o.items) {
    if (it.category && TOP_EXCLUDE.has(it.category)) continue;
    const t = top.get(it.name) ?? { qty: 0, sum: 0 };
    t.qty += it.quantity; t.sum += it.quantity * it.price;
    top.set(it.name, t);
  }
  return {
    ok: ok.length,
    canceled: orders.length - ok.length,
    revenue,
    avg: ok.length ? revenue / ok.length : 0,
    delivery: ok.filter((o) => o.deliveryType === "delivery").length,
    pickup: ok.filter((o) => o.deliveryType === "pickup").length,
    fromAccounts: ok.filter((o) => o.userId).length,
    uniquePhones: phones.size,
    days,
    byMonth,
    top: [...top.entries()].map(([name, t]) => ({ name, ...t })),
  };
}

/** Вибір періоду всередині блоку: Тиждень / Місяць / Рік / Весь час + 📅 свої дати. */
function PeriodPicker({ value, onChange, today, firstDay }: {
  value: Period; onChange: (p: Period) => void; today: string; firstDay: string | null;
}) {
  const [cal, setCal] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "clamp(10px, 3vw, 14px) clamp(10px, 3vw, 22px) 0" }}>
      <div className={s.presetRow}>
        {(["week", "month", "year", "all"] as const).map((k) => (
          <button key={k} onClick={() => { setCal(false); onChange(presetPeriod(k, today, firstDay)); }}
            className={`chip square ${value.key === k ? "active" : ""}`}>{PRESET_LABEL[k]}</button>
        ))}
        <button onClick={() => setCal(true)} aria-haspopup="dialog" title="Обрати дати в календарі"
          className={`chip square ${value.key === "custom" ? "active" : ""}`}>
          📅{value.key === "custom" ? ` ${periodTitle(value)}` : ""}
        </button>
      </div>
      {cal && (
        <RangeCalendar from={value.from} to={value.to} min={firstDay} max={today}
          onApply={(from, to) => onChange({ key: "custom", from, to })} onClose={() => setCal(false)} />
      )}
    </div>
  );
}

export default function StatsPage() {
  const [today, setToday] = useState("");
  const [firstDay, setFirstDay] = useState<string | null>(null);
  useEffect(() => { dbFirstOrderAt().then((iso) => setFirstDay(iso ? kyivDay(iso) : null)); }, []);
  // дати — лише на клієнті (гідрація) і за київським часом
  useEffect(() => { setToday(kyivNow().date); }, []);
  if (!today) return null;
  const blockProps = { today, firstDay };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 3vw, 20px)" }}>
      <TopBlock {...blockProps} />
      <OrdersBlock {...blockProps} />
      <ChartBlock {...blockProps} />
      <UsersBlock {...blockProps} />
    </div>
  );
}

type BlockProps = { today: string; firstDay: string | null };
const Loading = () => <p className={s.hint} style={{ padding: "12px clamp(10px, 3vw, 22px)", margin: 0 }}>Завантаження…</p>;

function TopBlock({ today, firstDay }: BlockProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod("month", today, firstDay));
  const orders = usePeriodOrders(period);
  const stats = useMemo(() => (orders ? computeStats(orders, period.from, period.to) : null), [orders, period.from, period.to]);
  return (
    // відкритий за замовчуванням — найчастіше дивляться саме його (новий ключ — щоб старе «згорнуто» не діяло)
    <Collapsible title={`Топ товарів · ${periodTitle(period)}`} storageKey="stats:top:v2" defaultOpen>
      <PeriodPicker value={period} onChange={setPeriod} today={today} firstDay={firstDay} />
      {stats ? <TopProducts rows={stats.top} /> : <Loading />}
    </Collapsible>
  );
}

function OrdersBlock({ today, firstDay }: BlockProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod("week", today, firstDay));
  const orders = usePeriodOrders(period);
  const stats = useMemo(() => (orders ? computeStats(orders, period.from, period.to) : null), [orders, period.from, period.to]);
  const { from, to } = period;
  return (
    <Collapsible title={`Замовлення · ${periodTitle(period)}`} storageKey="stats:orders">
      <PeriodPicker value={period} onChange={setPeriod} today={today} firstDay={firstDay} />
      {!stats ? <Loading /> : (
        <>
          <div className={s.statGridCompact} style={BLOCK_PAD}>
            <Stat num={stats.ok} label="Замовлень" sub={stats.canceled ? `+ ${stats.canceled} скасовано` : undefined}
              href={`/admin/orders/board?date=${from === to ? from : "all"}`} />
            <Stat num={money(stats.revenue)} label="Виручка" />
            <Stat num={stats.ok ? money(stats.avg) : "—"} label="Середній чек" />
            <Stat num={stats.uniquePhones} label="Унікальних клієнтів" sub="за номером телефону" href="/admin/customers" />
            <Stat num={`${stats.delivery} / ${stats.pickup}`} label="Доставка / самовивіз" />
            <Stat num={stats.fromAccounts} label="З акаунтів" sub={`гостьових: ${stats.ok - stats.fromAccounts}`} href={CUST_REG} />
          </div>
        </>
      )}
    </Collapsible>
  );
}

function ChartBlock({ today, firstDay }: BlockProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod("week", today, firstDay));
  const [metric, setMetric] = useState<Metric>("count");
  const orders = usePeriodOrders(period);
  const stats = useMemo(() => (orders ? computeStats(orders, period.from, period.to) : null), [orders, period.from, period.to]);
  return (
    <Collapsible title={`${stats?.byMonth ? "По місяцях" : "По днях"} · ${periodTitle(period)}`} storageKey="stats:chart"
      right={
        <div style={{ display: "flex", gap: 6 }}>
          {([["count", "Замовлення"], ["revenue", "Виручка"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setMetric(v)} className={`chip square ${metric === v ? "active" : ""}`}>{l}</button>
          ))}
        </div>
      }>
      <PeriodPicker value={period} onChange={setPeriod} today={today} firstDay={firstDay} />
      {stats ? <DayChart days={stats.days} metric={metric} byMonth={stats.byMonth} /> : <Loading />}
    </Collapsible>
  );
}

function UsersBlock({ today, firstDay }: BlockProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod("week", today, firstDay));
  const { customers, loading } = useDbCustomers();
  const newUsers = customers.filter((c) => { const d = kyivDay(c.createdAt); return d >= period.from && d <= period.to; }).length;
  const withPhone = customers.filter((c) => c.phone).length;
  return (
    <Collapsible title={`Користувачі сайту · ${periodTitle(period)}`} storageKey="stats:users">
      <PeriodPicker value={period} onChange={setPeriod} today={today} firstDay={firstDay} />
      <div className={s.statGridCompact} style={BLOCK_PAD}>
        <Stat num={loading ? "…" : customers.length} label="Усього акаунтів" href={CUST_REG} />
        <Stat num={loading ? "…" : newUsers} label="Нових за період" href={CUST_REG} />
        <Stat num={loading ? "…" : withPhone} label="Вказали телефон" href={CUST_REG} />
      </div>
    </Collapsible>
  );
}

/** Внутрішній відступ блоку з плитками — менший на телефоні. */
const BLOCK_PAD = { padding: "clamp(8px, 2.5vw, 16px) clamp(10px, 3vw, 22px)" } as const;

const TOP_LIMIT = 10;
/** Категорії, яких немає в «Топ товарів» (slug). */
const TOP_EXCLUDE = new Set(["додатково"]);
const CUST_REG = "/admin/customers?tab=registered";

/** Топ товарів — горизонтальні смуги: довжина = кількість або сума (перемикач), найбільші зверху.
 *  Клік по товару — до нього в «Товари». */
function TopProducts({ rows }: { rows: { name: string; qty: number; sum: number }[] }) {
  const [by, setBy] = useState<"qty" | "sum">("qty");
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className={s.hint} style={{ padding: 16, margin: 0 }}>Немає замовлень за період.</p>;
  const val = (r: { qty: number; sum: number }) => (by === "qty" ? r.qty : r.sum);
  const sorted = [...rows].sort((a, b) => val(b) - val(a) || a.name.localeCompare(b.name, "uk"));
  const shown = all ? sorted : sorted.slice(0, TOP_LIMIT);
  const max = Math.max(1, val(sorted[0]));
  return (
    <div style={{ padding: "clamp(10px, 3vw, 16px) clamp(10px, 3vw, 22px)" }}>
      {/* шапка-сортування: клік по колонці — сортуємо за нею (і довжина смуги — за нею) */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-secondary)", padding: "0 0 8px", borderBottom: "1px solid var(--border)", marginBottom: 10 }}>
        <span style={{ width: 22, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Товар</span>
        {([["qty", "К-сть", 52], ["sum", "Сума", 84]] as const).map(([v, l, w]) => (
          <button key={v} type="button" onClick={() => setBy(v)} aria-pressed={by === v}
            style={{ width: w, flexShrink: 0, textAlign: "right", padding: 0, background: "none", border: "none", cursor: "pointer", font: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: by === v ? "var(--accent)" : "var(--text-secondary)" }}>
            {l}{by === v ? " ▼" : ""}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((r, i) => (
          <Link key={r.name} href={`/admin/products?q=${encodeURIComponent(r.name)}`} style={{ textDecoration: "none", color: "inherit" }}
            title={`${r.name}: ${r.qty} шт · ${money(r.sum)}`}>
            {/* колонки фіксованої ширини, цифри однакової ширини — значення стоять рівно одне під одним */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, marginBottom: 3, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ width: 22, flexShrink: 0, textAlign: "right", color: "var(--text-secondary)" }}>{i + 1}.</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              {/* колонки на місці: к-сть, потім сума; та, за якою сортуємо, — жирна */}
              <span style={{ width: 52, flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", ...(by === "qty" ? { fontWeight: 700 } : { color: "var(--text-secondary)", fontSize: 12 }) }}>
                {r.qty} шт
              </span>
              <span style={{ width: 84, flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", ...(by === "sum" ? { fontWeight: 700 } : { color: "var(--text-secondary)", fontSize: 12 }) }}>
                {money(r.sum)}
              </span>
            </div>
            <div style={{ height: 8, marginLeft: 30, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${(val(r) / max) * 100}%`, minWidth: 2, height: "100%", background: "var(--accent)", borderRadius: 4 }} />
            </div>
          </Link>
        ))}
      </div>
      {rows.length > TOP_LIMIT && (
        <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ marginTop: 12 }} onClick={() => setAll((v) => !v)}>
          {all ? "Згорнути" : `Показати більше (ще ${rows.length - TOP_LIMIT})`}
        </button>
      )}
    </div>
  );
}

/** Плитка: якщо є href — клікабельна (веде туди, де видно деталі). */
function Stat({ num, label, sub, href }: { num: string | number; label: string; sub?: string; href?: string }) {
  const body = (
    <div className={s.stat}>
      <div className={s.statNum}>{num}</div>
      <div className={s.statLabel}>{label}{href && <span aria-hidden style={{ marginLeft: 4, opacity: 0.6 }}>›</span>}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  );
  return href
    ? <Link href={href} className={`${s.card} ${s.statLink}`} style={{ textDecoration: "none" }}>{body}</Link>
    : <div className={s.card}>{body}</div>;
}

/** Стовпчики по днях: одна метрика, одна шкала; підказка при наведенні. */
function DayChart({ days, metric, byMonth }: { days: { day: string; count: number; revenue: number }[]; metric: Metric; byMonth: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const isMobile = useIsMobile(700);
  const label = byMonth ? monthLabel : dayLabel;
  const val = (d: { count: number; revenue: number }) => (metric === "count" ? d.count : d.revenue);
  const max = Math.max(1, ...days.map(val));
  const fmt = (n: number) => (metric === "count" ? String(n) : money(n));
  // підписи осі X — не частіше ніж ~6 (телефон) / ~12 (ширше) на графік
  const step = Math.max(1, Math.ceil(days.length / (isMobile ? 6 : 12)));
  const h = days[hover ?? -1];

  return (
    <div style={{ padding: "clamp(12px, 3vw, 18px) clamp(12px, 3vw, 22px) clamp(14px, 3vw, 22px)" }}>
      <div style={{ height: 22, fontSize: 13, color: "var(--text-secondary)" }}>
        {h ? <>{label(h.day)}: <b style={{ color: "var(--text-primary)" }}>{h.count} замовл.</b> · {money(h.revenue)}</>
          : `Максимум за ${byMonth ? "місяць" : "день"}: ${fmt(Math.max(0, ...days.map(val)))}`}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: isMobile ? 140 : 180, borderBottom: "1px solid var(--border-light)" }}
        onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <div key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
            title={`${label(d.day)}: ${d.count} замовл. · ${money(d.revenue)}`}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default" }}>
            <div style={{
              width: "100%", maxWidth: 36, margin: "0 auto",
              height: `${(val(d) / max) * 100}%`, minHeight: val(d) > 0 ? 2 : 0,
              background: "var(--accent)", opacity: hover === null || hover === i ? 1 : 0.45,
              borderRadius: "4px 4px 0 0", transition: "opacity 0.15s",
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {days.map((d, i) => (
          <div key={d.day} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "visible" }}>
            {i % step === 0 ? label(d.day) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
