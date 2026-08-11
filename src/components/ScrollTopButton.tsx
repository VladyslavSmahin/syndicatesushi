"use client";

import { useEffect, useState } from "react";

/**
 * Кнопка «вгору» — одна на весь проєкт (сайт + адмінка), підключена в root layout.
 * Стоїть знизу справа, на одній лінії з FAB «Фільтр» (той — зліва).
 */
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Вгору"
      title="Вгору"
      className="fade-in"
      style={{
        position: "fixed",
        right: "var(--fab-right, 18px)",
        bottom: "var(--fab-bottom, 24px)",
        zIndex: 95, width: 40, height: 40, borderRadius: 20,
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        color: "var(--text-primary)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
