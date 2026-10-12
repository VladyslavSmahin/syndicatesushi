"use client";

import { useEffect, useState } from "react";
import { normRefCode, saveRef, REF_PERCENT } from "@/lib/referral";

/** Прийшли за посиланням друга (?ref=CODE): запам'ятовуємо код, прибираємо його з адреси й коротко пояснюємо, що знижка вже чекає в кошику. */
export default function RefCapture() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = normRefCode(url.searchParams.get("ref"));
    if (!url.searchParams.has("ref")) return;
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!code) return;
    saveRef(code);
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 9000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="acc-promo ref-toast" role="status">
      <span className="acc-promo-gift" aria-hidden>🎁</span>
      <div>
        <b>Вас запросив друг!</b>
        <span>−{REF_PERCENT}% на перше замовлення — знижка сама зʼявиться в кошику.</span>
      </div>
      <button type="button" className="acc-promo-x" aria-label="Закрити" onClick={() => setShow(false)}>×</button>
    </div>
  );
}
