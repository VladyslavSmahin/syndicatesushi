"use client";

import { useState, type ReactNode } from "react";
import s from "./admin.module.css";

/** Картка адмінки, що розгортається/згортається. За замовчуванням — згорнута. */
export default function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.card}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={s.cardHead}
        style={{ width: "100%", background: "transparent", border: "none", borderBottom: open ? undefined : "none", cursor: "pointer", textAlign: "left" }}
      >
        <div className={s.cardTitle}>{title}</div>
        <span style={{ display: "inline-flex", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", color: "var(--text-secondary)", fontSize: 14 }}>
          ▾
        </span>
      </button>
      {open && children}
    </div>
  );
}
