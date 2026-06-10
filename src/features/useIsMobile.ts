"use client";

import { useEffect, useState } from "react";

/** true, якщо ширина екрана ≤ maxWidth. На SSR/першому рендері — false (без розбіжності гідрації). */
export function useIsMobile(maxWidth = 860): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return isMobile;
}
