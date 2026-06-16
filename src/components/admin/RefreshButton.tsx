"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import s from "./admin.module.css";

/** Кнопка «Оновити весь список»: викликає server action (revalidateTag) + перечитує RSC. */
export default function RefreshButton({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const onClick = () =>
    start(async () => {
      await action();
      router.refresh();
    });

  return (
    <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={onClick} disabled={pending}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={pending ? { animation: "spin 0.7s linear infinite" } : undefined}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
      </svg>
      {pending ? "Оновлення…" : "Оновити"}
    </button>
  );
}
