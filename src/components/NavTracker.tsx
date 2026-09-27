"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
// імпорт реєструє глобальний popstate-слухач ще до монтування будь-якої сторінки
import { markInAppNavigation, consumePopNavigation } from "@/features/navHistory";

/** Позначає, що користувач уже переходив сторінками сайту (є куди вертатися «назад»). */
export default function NavTracker() {
  const pathname = usePathname();
  // попередній шлях (а не «перший запуск»): strict mode запускає ефект двічі на тому ж шляху
  const prev = useRef(pathname);
  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    // «назад/вперед» веде на вже існуючий крок — його позначку не чіпаємо (інакше сторінка,
    // відкрита з Google, стала б «внутрішньою» і кнопка «назад» повела б назад у Google)
    if (consumePopNavigation()) return;
    markInAppNavigation();
  }, [pathname]);
  return null;
}
