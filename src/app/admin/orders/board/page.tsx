"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useDbOrders, dbSetOrderStatus, type DbOrder, type OrderStatus } from "@/features/admin/db";
import s from "@/components/admin/admin.module.css";

// Колонки дошки = робочий потік заказу. Значення статусів у БД ті самі (new/confirmed/done/canceled).
const COLUMNS: { value: OrderStatus; label: string; accent: string }[] = [
  { value: "new", label: "Нові", accent: "#E0A24A" },
  { value: "confirmed", label: "В роботі", accent: "#4A9DE0" },
  { value: "done", label: "Виконано", accent: "#5BB85B" },
  { value: "canceled", label: "Скасовані", accent: "#8A8A8A" },
];
const ORDER: OrderStatus[] = COLUMNS.map((c) => c.value);

export default function OrdersBoardPage() {
  const { orders, loading, refetch } = useDbOrders();
  // локальна копія для миттєвого drag&drop (оптимістично), синхронізується з БД
  const [local, setLocal] = useState<DbOrder[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<OrderStatus | null>(null);
  const pending = useRef<Set<string>>(new Set());

  useEffect(() => { setLocal(orders); }, [orders]);

  const byCol = useMemo(() => {
    const map: Record<OrderStatus, DbOrder[]> = { new: [], confirmed: [], done: [], canceled: [] };
    for (const o of local) map[o.status].push(o);
    return map;
  }, [local]);

  const move = async (id: string, to: OrderStatus) => {
    const cur = local.find((o) => o.id === id);
    if (!cur || cur.status === to) return;
    setLocal((prev) => prev.map((o) => (o.id === id ? { ...o, status: to } : o)));
    pending.current.add(id);
    try {
      await dbSetOrderStatus(id, to);
    } catch {
      setLocal((prev) => prev.map((o) => (o.id === id ? { ...o, status: cur.status } : o))); // відкат
    } finally {
      pending.current.delete(id);
      if (pending.current.size === 0) refetch(); // підтягуємо з БД, коли всі переміщення завершені
    }
  };

  const onDrop = (to: OrderStatus) => {
    if (dragId) move(dragId, to);
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p className={s.hint} style={{ margin: 0 }}>
          Перетягуйте картки між колонками, щоб змінити статус. Або стрілками ‹ › на картці.
          Зміни одразу зберігаються в БД.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => refetch()}>Оновити</button>
          <Link href="/admin/orders" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}>Список</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))`, gap: 12, alignItems: "start", overflowX: "auto", paddingBottom: 8 }}>
        {COLUMNS.map((col) => {
          const list = byCol[col.value];
          const isOver = overCol === col.value;
          return (
            <div key={col.value}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.value); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
              onDrop={() => onDrop(col.value)}
              style={{
                background: "var(--bg-card)", border: `1px solid ${isOver ? col.accent : "var(--border)"}`,
                borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 200,
                transition: "border-color 0.15s", outline: isOver ? `2px solid ${col.accent}55` : "none",
              }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: col.accent }} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{col.label}</span>
                <span className={s.hint} style={{ marginLeft: "auto", fontSize: 12 }}>{list.length}</span>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {loading && local.length === 0 ? (
                  <p className={s.hint} style={{ fontSize: 12, padding: 6 }}>Завантаження…</p>
                ) : list.length === 0 ? (
                  <p className={s.hint} style={{ fontSize: 12, padding: 6, opacity: 0.6 }}>Порожньо</p>
                ) : (
                  list.map((o) => (
                    <BoardCard key={o.id} order={o} accent={col.accent}
                      onDragStart={() => setDragId(o.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onPrev={prevOf(o.status) ? () => move(o.id, prevOf(o.status)!) : undefined}
                      onNext={nextOf(o.status) ? () => move(o.id, nextOf(o.status)!) : undefined} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const prevOf = (st: OrderStatus): OrderStatus | null => { const i = ORDER.indexOf(st); return i > 0 ? ORDER[i - 1] : null; };
const nextOf = (st: OrderStatus): OrderStatus | null => { const i = ORDER.indexOf(st); return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null; };

function BoardCard({ order, accent, onDragStart, onDragEnd, onPrev, onNext }: {
  order: DbOrder; accent: string;
  onDragStart: () => void; onDragEnd: () => void;
  onPrev?: () => void; onNext?: () => void;
}) {
  const time = new Date(order.createdAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const qty = order.items.reduce((n, it) => n + it.quantity, 0);
  const arrowBtn: CSSProperties = {
    width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-light)", background: "transparent",
    color: "var(--text-primary)", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border)", borderLeft: `3px solid ${accent}`,
        borderRadius: 8, padding: "10px 12px", cursor: "grab", userSelect: "none",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{order.customerName}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: accent }}>{order.total} грн</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--text-secondary)" }}>
        <a href={`tel:${order.phone}`} style={{ color: "var(--accent)" }}>{order.phone}</a>
        <span>· {order.deliveryType === "delivery" ? "🛵 Доставка" : "🏠 Самовивіз"}</span>
        <span>· {qty} шт</span>
      </div>
      {order.address && <p className={s.hint} style={{ fontSize: 11, margin: 0 }}>📍 {order.address}</p>}
      <details style={{ fontSize: 11 }}>
        <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>Склад ({order.items.length})</summary>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "var(--text-primary)" }}>
              <span>{it.name} ×{it.quantity}</span><span style={{ color: "var(--text-secondary)" }}>{it.price * it.quantity} грн</span>
            </div>
          ))}
          {order.comment && <p className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>💬 {order.comment}</p>}
        </div>
      </details>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <span className={s.hint} style={{ fontSize: 10 }}>{time}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...arrowBtn, opacity: onPrev ? 1 : 0.3, cursor: onPrev ? "pointer" : "default" }}
            disabled={!onPrev} onClick={onPrev} aria-label="Назад за статусом">‹</button>
          <button style={{ ...arrowBtn, opacity: onNext ? 1 : 0.3, cursor: onNext ? "pointer" : "default" }}
            disabled={!onNext} onClick={onNext} aria-label="Далі за статусом">›</button>
        </div>
      </div>
    </div>
  );
}
