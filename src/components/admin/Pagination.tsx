"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import s from "./admin.module.css";

/** Пагінація на основі URL (?page=). Зберігає інші параметри (напр. ?q=). */
export default function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();

  if (pageCount <= 1) {
    return <div className={s.hint} style={{ padding: "12px 0", fontSize: 12 }}>Усього: {total}</div>;
  }

  const go = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page"); else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", flexWrap: "wrap" }}>
      <span className={s.hint} style={{ fontSize: 12 }}>Усього: {total}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => go(page - 1)} disabled={page <= 1}>‹ Назад</button>
        <span className={s.hint} style={{ fontSize: 12, minWidth: 90, textAlign: "center" }}>Стор. {page} / {pageCount}</span>
        <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => go(page + 1)} disabled={page >= pageCount}>Далі ›</button>
      </div>
    </div>
  );
}
