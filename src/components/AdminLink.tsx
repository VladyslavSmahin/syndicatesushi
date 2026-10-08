"use client";

import { useStaffRole } from "@/features/account";

/** Кнопка «Адмінка» в шапці — лише для співробітників (admin/editor). */
export default function AdminLink({ className }: { className?: string }) {
  const role = useStaffRole();
  if (!role) return null;
  return (
    <a
      href="/admin"
      className={className}
      style={{
        display: "inline-flex", alignItems: "center", height: 44, padding: "0 14px", flexShrink: 0,
        border: "1px solid var(--accent)", color: "var(--accent)", textDecoration: "none",
        fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", whiteSpace: "nowrap",
      }}
    >
      Адмінка
    </a>
  );
}
