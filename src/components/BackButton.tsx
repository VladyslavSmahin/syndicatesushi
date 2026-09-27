"use client";

import { useRouter } from "next/navigation";
import { hasInAppHistory } from "@/features/navHistory";

/**
 * Акуратна кнопка «назад» у шапці внутрішніх сторінок.
 * Якщо прийшли з іншої сторінки сайту — повертає туди (зі збереженим станом головної),
 * якщо сторінку відкрили напряму (з пошуку/посилання) — веде на головну.
 */
export default function BackButton() {
  const router = useRouter();
  const onClick = () => {
    if (hasInAppHistory()) router.back();
    else router.push("/");
  };
  return (
    <button type="button" onClick={onClick} aria-label="Назад" className="back-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
