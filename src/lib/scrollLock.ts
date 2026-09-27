"use client";

import { useEffect } from "react";

/**
 * Блокування скролу сторінки під модалками/шторками.
 *
 * - Лічильник: кілька відкритих одночасно (фільтр + картка) — розблоковуємо, лише коли закрита остання.
 * - iOS Safari ігнорує `overflow: hidden` на body, тому фіксуємо body на поточній позиції
 *   (position: fixed + top: -scrollY) і після закриття повертаємо скрол туди ж.
 */

let locks = 0;
let savedY = 0;
let savedPath = "";

export function isScrollLocked() {
  return locks > 0;
}

function lock() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  savedPath = window.location.pathname;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${savedY}px`;
  b.left = "0";
  b.right = "0";
  b.width = "100%";
  b.overflow = "hidden";
}

function unlock() {
  if (locks === 0 || --locks > 0) return;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = b.overflow = "";
  // якщо з модалки перейшли на іншу сторінку — її скрол не чіпаємо
  if (window.location.pathname === savedPath) window.scrollTo({ top: savedY, behavior: "instant" });
}

/** Блокує скрол сторінки, поки active === true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
