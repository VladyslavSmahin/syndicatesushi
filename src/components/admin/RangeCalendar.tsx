"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addDays } from "@/lib/kyivTime";
import { useScrollLock } from "@/lib/scrollLock";

/** Календар-вікно для вибору періоду: перший тап — початок, другий — кінець (діапазон підсвічується).
 *  Дати — рядки YYYY-MM-DD (київські), як і всюди в статистиці. */

const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const ym = (d: string) => d.slice(0, 7);
const shiftMonth = (m: string, k: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export default function RangeCalendar({ from, to, min, max, onApply, onClose }: {
  from: string; to: string; min?: string | null; max: string;
  onApply: (from: string, to: string) => void; onClose: () => void;
}) {
  useScrollLock(true);
  const [a, setA] = useState(from);
  const [b, setB] = useState<string | null>(to); // null — обрано лише початок, чекаємо кінець
  const [month, setMonth] = useState(ym(to));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (d: string) => {
    if (b === null) { if (d < a) { setB(a); setA(d); } else setB(d); }
    else { setA(d); setB(null); }
  };

  // сітка місяця з понеділка
  const first = `${month}-01`;
  const dow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: dow }, () => null);
  for (let d = first; ym(d) === month; d = addDays(d, 1)) cells.push(d);
  const lo = a, hi = b ?? a;
  const disabled = (d: string) => d > max || (!!min && d < min);

  return createPortal(
    <div className="fade-in rc-overlay" onClick={onClose}>
      <div className="rc modal-pop" role="dialog" aria-modal="true" aria-label="Обрати період" onClick={(e) => e.stopPropagation()}>
        <div className="rc-range">
          <span className={b === null ? "on" : ""}>з <b>{fmt(a)}</b></span>
          <span className={b === null ? "wait" : ""}>по <b>{b ? fmt(b) : "…"}</b></span>
        </div>
        <div className="rc-head">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} disabled={!!min && shiftMonth(month, -1) < ym(min)} aria-label="Попередній місяць">‹</button>
          <span>{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</span>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={shiftMonth(month, 1) > ym(max)} aria-label="Наступний місяць">›</button>
        </div>
        <div className="rc-grid">
          {WEEK.map((w) => <span key={w} className="rc-dow">{w}</span>)}
          {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
            <button key={d} type="button" disabled={disabled(d)} onClick={() => pick(d)}
              className={`rc-day${d === lo || d === hi ? " edge" : ""}${d > lo && d < hi ? " in" : ""}${d === max ? " today" : ""}`}>
              {Number(d.slice(8, 10))}
            </button>
          ))}
        </div>
        <p className="rc-hint">{b === null ? "Оберіть кінцеву дату" : "Тапніть дату, щоб почати новий період"}</p>
        <div className="rc-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Скасувати</button>
          <button type="button" className="btn-primary" onClick={() => { onApply(lo, hi); onClose(); }}>Застосувати</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
