"use client";

import { useEffect, useState } from "react";

/** Кнопка «вгору» — фіксовано знизу справа, зʼявляється при прокрутці. */
export default function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Вгору"
      style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 80, width: 46, height: 46, borderRadius: 23,
        background: "var(--accent)", color: "#0A0908", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
