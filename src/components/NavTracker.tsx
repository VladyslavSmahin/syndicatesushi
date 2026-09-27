"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
// імпорт реєструє глобальний popstate-слухач ще до монтування будь-якої сторінки
import { markInAppNavigation } from "@/features/navHistory";

/** Позначає, що користувач уже переходив сторінками сайту (є куди вертатися «назад»). */
export default function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    markInAppNavigation();
  }, [pathname]);
  return null;
}
