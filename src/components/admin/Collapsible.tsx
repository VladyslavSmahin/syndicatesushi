"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "./admin.module.css";

/** Картка адмінки, що розгортається/згортається кліком по заголовку. За замовчуванням — згорнута.
 *  storageKey — запамʼятовує стан для поточного співробітника (localStorage, ключ з його id);
 *  right — елементи в шапці праворуч (напр. перемикачі), клік по них не згортає картку. */
export default function Collapsible({
  title,
  defaultOpen = false,
  storageKey,
  right,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  storageKey?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAdminAuth();
  const key = storageKey && user ? `admin-collapse:${user.id}:${storageKey}` : null;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!key) return;
    try {
      const v = localStorage.getItem(key);
      if (v === "1" || v === "0") setOpen(v === "1");
    } catch { /* немає доступу до сховища — лишаємо дефолт */ }
  }, [key]);

  const toggle = () =>
    setOpen((o) => {
      if (key) { try { localStorage.setItem(key, o ? "0" : "1"); } catch { /* ignore */ } }
      return !o;
    });

  return (
    <div className={s.card}>
      <div className={s.cardHead} style={{ borderBottom: open ? undefined : "none", gap: 10 }}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: 0,
            background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "inherit",
          }}
        >
          <span style={{ display: "inline-flex", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", color: "var(--text-secondary)", fontSize: 14 }}>
            ▾
          </span>
          <div className={s.cardTitle}>{title}</div>
        </button>
        {open && right}
      </div>
      {open && children}
    </div>
  );
}
