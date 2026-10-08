"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFavorites } from "@/features/favorites/FavoritesContext";
import { Icon } from "./icons";

/** Плаваюча зірочка справа (над «Вгору»): є щось в обраному → тап відкриває вкладку «Обране» в кабінеті.
 *  Гостя кабінет попросить увійти — обране з цього браузера після входу перенесеться в акаунт. */
export default function FavoritesFab() {
  const pathname = usePathname() ?? "";
  const { ids } = useFavorites();
  const count = ids.length;
  // «підстрибує», коли кількість змінюється
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count !== prev.current) { prev.current = count; setBump((b) => b + 1); }
  }, [count]);

  if (!count || /^\/(admin|account|auth)/.test(pathname)) return null;

  return (
    <a href="/account?tab=favorites" className="fav-fab fade-in" aria-label={`Обране: ${count}`} title="Обране">
      <Icon.Star key={bump} filled width="18" height="18" strokeWidth={1.4} className={bump ? "fav-pop" : undefined} />
      <span className="fav-fab-count">{count > 99 ? "99+" : count}</span>
    </a>
  );
}
