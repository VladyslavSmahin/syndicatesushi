"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDbCustomers, dbStatsOrders, dbFirstOrderAt, type StatsOrder } from "@/features/admin/db";
import { useIsMobile } from "@/features/useIsMobile";
import { kyivNow, addDays } from "@/lib/kyivTime";
import s from "@/components/admin/admin.module.css";
import Collapsible from "@/components/admin/Collapsible";

// Статистика сайту: користувачі + замовлення за обраний період (дні — за київським часом).

type Metric = "count" | "revenue";

const kyivDay = (iso: string) => kyivNow(new Date(iso)).date;
const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const money = (n: number) => `${Math.round(n).toLocaleString("uk-UA")} грн`;

const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
/** Довгий період (напр. «Весь час») — групуємо по місяцях, інакше стовпчики стають нечитабельні. */
const BY_MONTH_FROM_DAYS = 62;

function presets(today: string, firstDay: string | null) {
  const monthStart = today.slice(0, 8) + "01";
  const prevMonthEnd = addDays(monthStart, -1);
  return [
    { label: "Сьогодні", from: today, to: today },
    { label: "Вчора", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "7 днів", from: addDays(today, -6), to: today },
    { label: "30 днів", from: addDays(today, -29), to: today },
    { label: "Цей місяць", from: monthStart, to: today },
    { label: "Минулий місяць", from: prevMonthEnd.slice(0, 8) + "01", to: prevMonthEnd },
    { label: "Весь час", from: firstDay && firstDay < today ? firstDay : today, to: today },
  ];
}

export default function StatsPage() {
  const [today, setToday] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orders, setOrders] = useState<StatsOrder[] | null>(null);
  const [metric, setMetric] = useState<Metric>("count");
  const { customers, loading: custLoading } = useDbCustomers();
  const [firstDay, setFirstDay] = useState<string | null>(null);
  useEffect(() => { dbFirstOrderAt().then((iso) => setFirstDay(iso ? kyivDay(iso) : null)); }, []);

  // дати — лише на клієнті (гідрація) і за київським часом
  useEffect(() => {
    const t = kyivNow().date;
    setToday(t);
    setFrom(addDays(t, -6));
    setTo(t);
  }, []);

  useEffect(() => {
    if (!from || !to || from > to) return;
    let active = true;
    setOrders(null);
    // з запасом ±1 день по UTC, точний відбір — за київською датою нижче
    const fromIso = new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString();
    const toIso = new Date(`${addDays(to, 2)}T00:00:00Z`).toISOString();
    dbStatsOrders(fromIso, toIso).then((list) => {
      if (!active) return;
      setOrders(list.filter((o) => { const d = kyivDay(o.createdAt); return d >= from && d <= to; }));
    });
    return () => { active = false; };
  }, [from, to]);

  const stats = useMemo(() => {
    if (!orders) return null;
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
    for (const o of ok) for (const it of o.items) {
      const t = top.get(it.name) ?? { qty: 0, sum: 0 };
      t.qty += it.quantity; t.sum += it.quantity * it.price;
      top.set(it.name, t);
    }
    return {
      total: orders.length,
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
  }, [orders, from, to]);

  const newUsers = customers.filter((c) => { const d = kyivDay(c.createdAt); return d >= from && d <= to; }).length;
  const usersWithPhone = customers.filter((c) => c.phone).length;

  if (!today) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 3vw, 20px)" }}>
      {/* користувачі — загалом, не залежать від періоду (крім «нових») */}
      <Collapsible title="Користувачі сайту" storageKey="stats:users">
        <div className={s.statGridCompact} style={BLOCK_PAD}>
          <Stat num={custLoading ? "…" : customers.length} label="Усього акаунтів" href={CUST_REG} />
          <Stat num={custLoading ? "…" : newUsers} label="Нових за період" href={CUST_REG} />
          <Stat num={custLoading ? "…" : usersWithPhone} label="Вказали телефон" href={CUST_REG} />
        </div>
      </Collapsible>

      {/* період — у заголовку видно обраний інтервал, навіть коли блок згорнуто */}
      <Collapsible title={`Період: ${dayLabel(from)}${from !== to ? ` — ${dayLabel(to)}` : ""}`} storageKey="stats:period">
      <div style={{ padding: "clamp(10px, 3vw, 16px)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className={s.presetRow}>
          {presets(today, firstDay).map((p) => (
            <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); }}
              className={`chip square ${from === p.from && to === p.to ? "active" : ""}`}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className={s.fieldLabel}>З</span>
          <input type="date" className={s.input} style={{ width: "auto" }} value={from} max={to || undefined}
            onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <span className={s.fieldLabel}>по</span>
          <input type="date" className={s.input} style={{ width: "auto" }} value={to} min={from || undefined}
            onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        {from > to && <p className={s.error} style={{ margin: 0 }}>Дата «з» пізніше за «по».</p>}
      </div>
      </Collapsible>

      {!stats ? <p className={s.hint}>Завантаження…</p> : (
        <>
          <Collapsible title="Замовлення за період" storageKey="stats:orders">
            <div className={s.statGridCompact} style={BLOCK_PAD}>
              <Stat num={stats.ok} label="Замовлень" sub={stats.canceled ? `+ ${stats.canceled} скасовано` : undefined}
                href={`/admin/orders/board?date=${from === to ? from : "all"}`} />
              <Stat num={money(stats.revenue)} label="Виручка" />
              <Stat num={stats.ok ? money(stats.avg) : "—"} label="Середній чек" />
              <Stat num={stats.uniquePhones} label="Унікальних клієнтів" sub="за номером телефону" href="/admin/customers" />
              <Stat num={`${stats.delivery} / ${stats.pickup}`} label="Доставка / самовивіз" />
              <Stat num={stats.fromAccounts} label="З акаунтів" sub={`гостьових: ${stats.ok - stats.fromAccounts}`} href={CUST_REG} />
            </div>
            <p className={s.hint} style={{ fontSize: 11, margin: 0, padding: "0 clamp(10px, 3vw, 22px) 12px" }}>
              Виручка й чек — без скасованих замовлень, за сумою «Разом» (без вартості доставки).
            </p>
          </Collapsible>

          <Collapsible title={stats.byMonth ? "По місяцях" : "По днях"} storageKey="stats:chart"
            right={
              <div style={{ display: "flex", gap: 6 }}>
                {([["count", "Замовлення"], ["revenue", "Виручка"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setMetric(v)} className={`chip square ${metric === v ? "active" : ""}`}>{l}</button>
                ))}
              </div>
            }>
            <DayChart days={stats.days} metric={metric} byMonth={stats.byMonth} />
          </Collapsible>

          <Collapsible title="Топ товарів" storageKey="stats:top">
            <TopProducts rows={stats.top} />
          </Collapsible>
        </>
      )}
    </div>
  );
}

/** Внутрішній відступ блоку з плитками — менший на телефоні. */
const BLOCK_PAD = { padding: "clamp(8px, 2.5vw, 16px) clamp(10px, 3vw, 22px)" } as const;

const TOP_LIMIT = 20;
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
      <div className={s.presetRow} style={{ marginBottom: 10 }}>
        {([["qty", "За кількістю"], ["sum", "За сумою"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setBy(v)} className={`chip square ${by === v ? "active" : ""}`}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((r, i) => (
          <Link key={r.name} href={`/admin/products?q=${encodeURIComponent(r.name)}`} style={{ textDecoration: "none", color: "inherit" }}
            title={`${r.name}: ${r.qty} шт · ${money(r.sum)}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 3 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--text-secondary)", marginRight: 6 }}>{i + 1}.</span>{r.name}
              </span>
              <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                {by === "qty" ? `${r.qty} шт` : money(r.sum)}
                <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 11, marginLeft: 6 }}>
                  {by === "qty" ? money(r.sum) : `${r.qty} шт`}
                </span>
              </span>
            </div>
            <div style={{ height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${(val(r) / max) * 100}%`, minWidth: 2, height: "100%", background: "var(--accent)", borderRadius: 4 }} />
            </div>
          </Link>
        ))}
      </div>
      {rows.length > TOP_LIMIT && (
        <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ marginTop: 12 }} onClick={() => setAll((v) => !v)}>
          {all ? "Згорнути" : `Показати всі (${rows.length})`}
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
