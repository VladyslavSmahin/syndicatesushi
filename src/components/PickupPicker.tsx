"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dayOptions, timeSlots } from "@/lib/kyivTime";

// Вибір дати й часу замовлення (самовивіз або доставка): аркуш із «каруселями» (як нативний пікер в iOS).
// За замовчуванням — найближчий робочий день + «по готовності» / «якнайшвидше»; час обирається зі
// слотів у межах годин роботи закладу (минулі слоти на сьогодні не показуємо).
// Дні й слоти рахуються за київським часом (див. @/lib/kyivTime).

const ITEM_H = 40;      // висота пункту каруселі
const VISIBLE = 5;      // скільки пунктів видно (непарне — щоб був центр)

export default function PickupPicker({
  delivery = "pickup", date, time, hours, onApply, onClose,
}: {
  delivery?: "delivery" | "pickup";
  date: string;
  time: string;           // "" = по готовності
  hours: string;          // години роботи закладу («11:00 — 22:00»)
  onApply: (date: string, time: string) => void;
  onClose: () => void;
}) {
  // дні без жодного слоту (сьогодні після закриття) не пропонуємо зовсім
  const days = useMemo(() => dayOptions(hours), [hours]);
  const [d, setD] = useState(days.some((x) => x.value === date) ? date : days[0]?.value ?? date);
  const [asap, setAsap] = useState(!time);
  const slots = useMemo(() => timeSlots(d, hours), [d, hours]);
  const [t, setT] = useState(time && slots.includes(time) ? time : slots[0] ?? "");

  // зміна дня може прибрати обраний час зі списку слотів — підставляємо найближчий
  useEffect(() => {
    if (!slots.length) { setT(""); setAsap(true); return; }
    if (!slots.includes(t)) setT(slots[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dayIndex = Math.max(0, days.findIndex((x) => x.value === d));
  const timeIndex = Math.max(0, slots.indexOf(t));
  const isDelivery = delivery === "delivery";
  const title = isDelivery ? "Час доставки" : "Час самовивозу";

  return createPortal(
    <>
      {/* оверлей-центрувальник: сам діалог без transform, щоб анімація modal-pop
          (вона перезаписує transform) не збивала центрування */}
      <div onClick={onClose} className="fade-in"
        style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(380px, 100%)", maxHeight: "90vh", overflowY: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border-light)",
          borderRadius: 14, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            {title}
          </span>
          <button type="button" onClick={onClose} aria-label="Закрити"
            style={{ width: 32, height: 32, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([[true, isDelivery ? "Якнайшвидше" : "По готовності"], [false, "На час"]] as const).map(([v, label]) => (
            <button key={label} type="button" onClick={() => setAsap(v)} disabled={!v && !slots.length}
              style={{
                flex: 1, padding: "10px 0", cursor: !v && !slots.length ? "not-allowed" : "pointer",
                fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                background: asap === v ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${asap === v ? "var(--accent)" : "var(--border-light)"}`,
                color: asap === v ? "var(--accent)" : "var(--text-secondary)",
                opacity: !v && !slots.length ? 0.4 : 1,
              }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, position: "relative" }}>
          {/* підсвітка центрального рядка — спільна для обох каруселей */}
          <div aria-hidden style={{
            position: "absolute", left: 0, right: 0, top: ITEM_H * ((VISIBLE - 1) / 2), height: ITEM_H,
            borderTop: "1px solid var(--border-light)", borderBottom: "1px solid var(--border-light)",
            background: "var(--bg-elevated)", pointerEvents: "none", borderRadius: 6,
          }} />
          <Wheel items={days.map((x) => x.label)} index={dayIndex} onIndex={(i) => setD(days[i].value)} label="День" />
          {asap ? (
            <div style={{ flex: 1, height: ITEM_H * VISIBLE, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5, padding: "0 8px" }}>
                {isDelivery
                  ? <>Приготуємо одразу<br />й привеземо</>
                  : <>Приготуємо одразу<br />і зателефонуємо</>}
              </span>
            </div>
          ) : slots.length ? (
            <Wheel items={slots} index={timeIndex} onIndex={(i) => setT(slots[i])} label="Час" />
          ) : (
            <div style={{ flex: 1, height: ITEM_H * VISIBLE, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5, padding: "0 8px" }}>
                На цей день часу вже немає
              </span>
            </div>
          )}
        </div>

        <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 14 }}
          onClick={() => onApply(d, asap ? "" : t)}>
          Готово
        </button>
      </div>
      </div>
    </>,
    document.body,
  );
}

/** Карусель: прокрутка зі снапом, обраний пункт — по центру. */
function Wheel({ items, index, onIndex, label }: {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // синхронізація прокрутки з обраним пунктом (при відкритті та зміні ззовні)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
  }, [index, items.length]);

  const onScroll = () => {
    window.clearTimeout(timer.current);
    // читаємо позицію після зупинки прокрутки — інакше вибір «стрибав» би під пальцем
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) onIndex(i);
    }, 90);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role="listbox"
      aria-label={label}
      className="no-scrollbar"
      style={{
        flex: 1, height: ITEM_H * VISIBLE, overflowY: "auto", position: "relative",
        scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}
    >
      <div style={{ height: ITEM_H * ((VISIBLE - 1) / 2) }} />
      {items.map((it, i) => {
        const dist = Math.abs(i - index);
        return (
          <button
            key={it}
            type="button"
            role="option"
            aria-selected={i === index}
            onClick={() => onIndex(i)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", height: ITEM_H, scrollSnapAlign: "center",
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
              fontFamily: "var(--font-body)", fontSize: dist === 0 ? 16 : 14,
              color: dist === 0 ? "var(--text-primary)" : "var(--text-secondary)",
              opacity: dist === 0 ? 1 : dist === 1 ? 0.65 : 0.35,
              letterSpacing: 0.5, transition: "opacity 0.15s, font-size 0.15s",
            }}
          >
            {it}
          </button>
        );
      })}
      <div style={{ height: ITEM_H * ((VISIBLE - 1) / 2) }} />
    </div>
  );
}
