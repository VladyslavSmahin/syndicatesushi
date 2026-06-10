"use client";

import { NAV_SPECIALS } from "@/data/site";
import { useCategories } from "@/features/admin/categoriesStore";
import { useIsMobile } from "@/features/useIsMobile";
import type { NavCategory } from "@/lib/types";

type NavFilter = NonNullable<NavCategory["filter"]>;

export default function MobileCategoryBar({
  active,
  onNavClick,
}: {
  active: NavFilter | null;
  onNavClick: (cat: NavCategory) => void;
}) {
  const isMobile = useIsMobile();
  const cats = useCategories({ navOnly: true });
  if (!isMobile) return null;

  const navItems: NavCategory[] = [
    ...NAV_SPECIALS,
    ...cats.map((c) => ({ id: c.id, label: c.name, filter: { category: c.slug } })),
  ];

  const isActive = (c: NavCategory) => {
    if (!active || !c.filter) return false;
    if (c.filter.category) return active.category === c.filter.category;
    if (c.filter.badge) return active.badge === c.filter.badge;
    return false;
  };

  return (
    <div
      style={{
        position: "fixed", left: 10, right: 10, bottom: 10, zIndex: 90,
        background: "rgba(20,17,14,0.92)", backdropFilter: "blur(14px)",
        border: "1px solid var(--border-light)", borderRadius: 14,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="no-scrollbar"
        style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 10px", scrollSnapType: "x proximity" }}
      >
        {navItems.map((c) => {
          const act = isActive(c);
          return (
            <button
              key={c.id}
              onClick={() => onNavClick(c)}
              style={{
                flexShrink: 0, scrollSnapAlign: "start",
                padding: "9px 16px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap",
                background: act ? "var(--accent)" : "var(--bg-elevated)",
                border: `1px solid ${act ? "var(--accent)" : "var(--border-light)"}`,
                color: act ? "#0A0908" : "var(--text-primary)", fontFamily: "var(--font-body)",
                fontSize: 13, fontWeight: act ? 600 : 500, letterSpacing: 0.5,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
