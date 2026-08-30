"use client";

import s from "./admin.module.css";

/** Ручка перетягування ⠿ + стрілки ↑/↓ (стрілки — для тачу, де drag не працює). */
export default function OrderHandle({
  handleProps,
  onUp,
  onDown,
  canUp,
  canDown,
  disabled = false,
}: {
  handleProps: Record<string, unknown>;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
  disabled?: boolean;
}) {
  return (
    <span className={s.dragCell}>
      <span
        {...(disabled ? {} : handleProps)}
        className={s.dragHandle}
        title={disabled ? "Порядок недоступний за пошуком" : "Перетягніть, щоб змінити порядок"}
        aria-hidden
        style={disabled ? { opacity: 0.3, cursor: "default" } : undefined}
      >
        ⠿
      </span>
      <span className={s.orderBtns}>
        <button type="button" className={s.orderBtn} onClick={onUp} disabled={disabled || !canUp} title="Вище" aria-label="Вище">▲</button>
        <button type="button" className={s.orderBtn} onClick={onDown} disabled={disabled || !canDown} title="Нижче" aria-label="Нижче">▼</button>
      </span>
    </span>
  );
}
