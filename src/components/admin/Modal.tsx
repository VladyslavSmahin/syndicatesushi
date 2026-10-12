"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/lib/scrollLock";
import s from "./admin.module.css";

export default function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // спільне блокування скролу (як на сайті): iOS ігнорує body overflow:hidden — сторінка під вікном не повинна їздити
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // портал у body: вікно може відкриватись із шапки/меню з backdrop-filter — тоді fixed рахувався б від них
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fade-in"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${s.card} modal-pop`}
        style={{ width: 540, maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className={s.cardHead}>
          <div className={s.cardTitle}>{title}</div>
          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={onClose}>Закрити</button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", overscrollBehavior: "contain" }}>{children}</div>
        {footer && (
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
