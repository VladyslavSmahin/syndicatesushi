"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDbOrders, dbSetOrderStatus, type DbOrder, type OrderStatus } from "@/features/admin/db";
import s from "@/components/admin/admin.module.css";

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "Нове" },
  { value: "confirmed", label: "Підтверджено" },
  { value: "done", label: "Виконано" },
  { value: "canceled", label: "Скасовано" },
];
const statusLabel = (st: OrderStatus) => STATUSES.find((x) => x.value === st)?.label ?? st;
const statusPill = (st: OrderStatus) =>
  st === "new" ? s.pillEditor : st === "done" ? s.pillOn : st === "canceled" ? s.pillOff : s.pillAdmin;

export default function OrdersPage() {
  const { orders, loading, refetch } = useDbOrders();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const shown = useMemo(() => (filter === "all" ? orders : orders.filter((o) => o.status === filter)), [orders, filter]);
  const setStatus = async (id: string, st: OrderStatus) => { await dbSetOrderStatus(id, st); refetch(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Замовлення з сайту. Статуси: Нове → Підтверджено → Виконано (або Скасовано).
        Дублюються в Telegram. Ціни рахуються на сервері з БД.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([["all", "Усі"], ...STATUSES.map((x) => [x.value, x.label] as const)] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v as OrderStatus | "all")}
            className={`chip square ${filter === v ? "active" : ""}`}>{l}</button>
        ))}
        <Link href="/admin/orders/board" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ marginLeft: "auto" }}>Дошка ▦</Link>
      </div>

      {loading ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : shown.length === 0 ? (
        <div className={s.card}><div className={s.placeholder}>
          <div className={s.placeholderTitle}>Замовлень немає</div>
          <p className={s.hint}>{filter === "all" ? "Нові замовлення зʼявляться тут." : "Немає замовлень із цим статусом."}</p>
        </div></div>
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} onStatus={(st) => setStatus(o.id, st)} />)
      )}
    </div>
  );
}

function OrderCard({ order, onStatus }: { order: DbOrder; onStatus: (st: OrderStatus) => void }) {
  const date = new Date(order.createdAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className={`${s.pill} ${statusPill(order.status)}`}>{statusLabel(order.status)}</span>
          <span className={s.cardTitle} style={{ fontSize: 16 }}>{order.customerName}</span>
          <a href={`tel:${order.phone}`} style={{ color: "var(--accent)", fontSize: 13 }}>{order.phone}</a>
          <span className={s.hint} style={{ fontSize: 11 }}>{date} · {order.deliveryType === "delivery" ? "Доставка" : "Самовивіз"}</span>
        </div>
        <select className={s.input} style={{ width: "auto", padding: "6px 10px" }}
          value={order.status} onChange={(e) => onStatus(e.target.value as OrderStatus)}>
          {STATUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </div>

      {(order.address || order.comment) && (
        <div style={{ padding: "0 22px 14px" }}>
          {order.address && <p className={s.hint} style={{ marginBottom: 6 }}>📍 {order.address}</p>}
          {order.comment && <p className={s.hint} style={{ marginBottom: 6 }}>💬 {order.comment}</p>}
        </div>
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>Позиція</th><th>Ціна</th><th>К-ть</th><th style={{ textAlign: "right" }}>Сума</th></tr></thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td style={{ color: "var(--text-secondary)" }}>{it.price} грн</td>
                <td>{it.quantity}</td>
                <td style={{ textAlign: "right" }}>{it.price * it.quantity} грн</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "12px 22px", display: "flex", justifyContent: "flex-end", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
        {order.discount > 0 && <span style={{ color: "var(--text-secondary)" }}>Знижка: −{order.discount} грн</span>}
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)" }}>Разом: {order.total} грн</span>
      </div>
    </div>
  );
}
