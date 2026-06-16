"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import s from "./admin.module.css";

/** Пошук на основі URL (?q=) із debounce. Скидає сторінку на 1. */
export default function AdminSearch({ placeholder = "Пошук…" }: { placeholder?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  // зовнішня зміна URL (напр. навігація) — синхронізуємо поле
  useEffect(() => { setValue(params.get("q") ?? ""); }, [params]);

  // debounce запис у URL
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const cur = params.get("q") ?? "";
      if (value.trim() === cur) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim()); else next.delete("q");
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      className={s.input}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ maxWidth: 280 }}
    />
  );
}
