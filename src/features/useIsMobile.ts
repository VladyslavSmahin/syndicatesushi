"use client";

import { useEffect, useState } from "react";

/**
 * true, якщо ширина екрана ≤ maxWidth.
 * Mobile first: на SSR/першому рендері — true (більшість відвідувачів з телефона), тож на мобільному
 * перший кадр одразу правильний, а підлаштовується після гідрації лише десктоп.
 */
export function useIsMobile(maxWidth = 860): boolean {
  const [isMobile, setIsMobile] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return isMobile;
}
