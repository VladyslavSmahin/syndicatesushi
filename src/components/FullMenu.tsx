"use client";

import { useEffect, useMemo, useState } from "react";
import MenuCard from "./MenuCard";
import { MENU, INGREDIENT_FILTERS } from "@/data/site";
import type { Product, NavCategory } from "@/lib/types";

type NavFilter = NonNullable<NavCategory["filter"]>;

export default function FullMenu({
  onAdd,
  onCardClick,
  activeFilterFromNav,
  clearNavFilter,
}: {
  onAdd: (item: Product) => void;
  onCardClick: (item: Product) => void;
  activeFilterFromNav: NavFilter | null;
  clearNavFilter: () => void;
}) {
  const [ingFilter, setIngFilter] = useState("Всі");
  const [navFilter, setNavFilter] = useState<NavFilter | null>(null);

  useEffect(() => {
    if (activeFilterFromNav) {
      setNavFilter(activeFilterFromNav);
      setIngFilter("Всі");
    }
  }, [activeFilterFromNav]);

  const items = useMemo(() => {
    let list = MENU;
    if (navFilter) {
      if (navFilter.category) list = list.filter((m) => m.category === navFilter.category);
      else if (navFilter.badge) list = list.filter((m) => m.badge === navFilter.badge);
    }
    if (ingFilter !== "Всі") {
      list = list.filter((m) => m.ingredients.includes(ingFilter.toLowerCase()));
    }
    return list;
  }, [ingFilter, navFilter]);

  return (
    <section id="menu" style={{ padding: "120px var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Наш асортимент</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
              Повне меню
            </h2>
            {navFilter && (
              <button
                onClick={() => { setNavFilter(null); clearNavFilter(); }}
                style={{
                  background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-secondary)",
                  padding: "8px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Скинути фільтр ×
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 48 }}>
          {INGREDIENT_FILTERS.map((f) => (
            <button key={f} onClick={() => setIngFilter(f)} className={`chip ${ingFilter === f ? "active" : ""}`}>
              {f}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22 }}>Нічого не знайдено за цим фільтром</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: 20 }}>
            {items.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={onAdd} onClick={() => onCardClick(item)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
