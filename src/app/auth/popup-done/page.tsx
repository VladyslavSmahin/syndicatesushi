"use client";

import { useEffect, useState } from "react";

// Кінець входу через Google у вікні window.open (застосунок на iPhone, див. lib/pwa.ts):
// сесія вже в cookie — закриваємо вікно, застосунок сам перейде далі. Якщо iOS закрити не дасть —
// показуємо кнопку, щоб продовжити тут.
export default function PopupDone() {
  const [next, setNext] = useState("/");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next") ?? "/";
    const safe = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
    setNext(safe);
    if (window.opener) window.close();
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Вхід виконано ✅</p>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>Можна закрити це вікно й повернутися до застосунку.</p>
        <a href={next} style={{ textDecoration: "underline" }}>Продовжити тут</a>
      </div>
    </main>
  );
}
