"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/admin/Modal";
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

const pad = (n: number) => String(n).padStart(2, "0");
const localDayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const timeLabel = (iso: string) => new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function OrdersPage() {
  const { orders, loading, refetch } = useDbOrders();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [day, setDay] = useState<string>(""); // "" = усі дні, інакше YYYY-MM-DD
  const [selected, setSelected] = useState<DbOrder | null>(null);

  const shown = useMemo(
    () => orders.filter((o) => (filter === "all" || o.status === filter) && (day === "" || localDayKey(o.createdAt) === day)),
    [orders, filter, day]
  );

  const setStatus = async (id: string, st: OrderStatus) => {
    await dbSetOrderStatus(id, st);
    setSelected((cur) => (cur && cur.id === id ? { ...cur, status: st } : cur));
    refetch();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className={s.hint}>
        Список замовлень. Натисніть на рядок, щоб переглянути деталі та змінити статус. Фільтр за статусом і днем — зверху.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([["all", "Усі"], ...STATUSES.map((x) => [x.value, x.label] as const)] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v as OrderStatus | "all")}
            className={`chip square ${filter === v ? "active" : ""}`}>{l}</button>
        ))}
        <Link href="/admin/orders/board" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ marginLeft: "auto" }}>Дошка ▦</Link>
      </div>

      {/* фільтр за днем — календар */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className={s.fieldLabel} style={{ marginRight: 4 }}>День:</span>
        <input type="date" className={s.input} style={{ width: "auto" }} value={day} onChange={(e) => setDay(e.target.value)} />
        {day && <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => setDay("")}>Усі дні</button>}
      </div>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Замовлення ({shown.length})</div></div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Статус</th><th>Клієнт</th><th>Телефон</th><th>Час</th><th>Тип</th><th style={{ textAlign: "right" }}>Сума</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Замовлень немає.</td></tr>
              ) : shown.map((o) => (
                <tr key={o.id} onClick={() => setSelected(o)} style={{ cursor: "pointer" }}>
                  <td data-label="Статус"><span className={`${s.pill} ${statusPill(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td data-label="Клієнт" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{o.customerName}</td>
                  <td data-label="Телефон" style={{ color: "var(--text-secondary)" }}>{o.phone}</td>
                  <td data-label="Час" style={{ color: "var(--text-secondary)" }}>{timeLabel(o.createdAt)}</td>
                  <td data-label="Тип" style={{ color: "var(--text-secondary)" }}>{o.deliveryType === "delivery" ? "Доставка" : "Самовивіз"}</td>
                  <td data-label="Сума" style={{ textAlign: "right", fontWeight: 700 }}>{o.total} грн</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Modal title={`Замовлення · ${selected.customerName}`} onClose={() => setSelected(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`${s.pill} ${statusPill(selected.status)}`}>{statusLabel(selected.status)}</span>
              <a href={`tel:${selected.phone}`} style={{ color: "var(--accent)" }}>{selected.phone}</a>
              <span className={s.hint} style={{ fontSize: 12 }}>{timeLabel(selected.createdAt)} · {selected.deliveryType === "delivery" ? "Доставка" : "Самовивіз"}</span>
            </div>

            <div className={s.field}>
              <span className={s.fieldLabel}>Статус</span>
              <select className={s.input} value={selected.status} onChange={(e) => setStatus(selected.id, e.target.value as OrderStatus)}>
                {STATUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>

            {selected.address && <p className={s.hint}>📍 {selected.address}</p>}
            {selected.comment && <p className={s.hint}>💬 {selected.comment}</p>}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Позиція</th><th>Ціна</th><th>К-ть</th><th style={{ textAlign: "right" }}>Сума</th></tr></thead>
                <tbody>
                  {selected.items.map((it, i) => (
                    <tr key={i}>
                      <td data-label="Позиція">{it.name}</td>
                      <td data-label="Ціна" style={{ color: "var(--text-secondary)" }}>{it.price} грн</td>
                      <td data-label="К-ть">{it.quantity}</td>
                      <td data-label="Сума" style={{ textAlign: "right" }}>{it.price * it.quantity} грн</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", fontSize: 13 }}>
              {selected.discount > 0 && <span style={{ color: "var(--text-secondary)" }}>Знижка: −{selected.discount} грн</span>}
              {selected.deliveryType === "delivery" && <span style={{ color: "var(--text-secondary)" }}>Доставка: {selected.deliveryCost} грн</span>}
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", fontSize: 16 }}>Разом: {selected.total} грн</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
