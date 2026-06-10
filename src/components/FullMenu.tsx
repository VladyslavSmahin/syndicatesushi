"use client";

import { useEffect, useMemo, useState } from "react";
import MenuCard from "./MenuCard";
import { MENU, INGREDIENT_FILTERS } from "@/data/site";
import { useCategories } from "@/features/admin/categoriesStore";
import { useIsMobile } from "@/features/useIsMobile";
import type { Product, NavCategory } from "@/lib/types";

type NavFilter = NonNullable<NavCategory["filter"]>;

const PAGE_SIZE = 6;
const INGREDIENTS = INGREDIENT_FILTERS.filter((f) => f !== "Всі");

export default function FullMenu({
  onAdd,
  onCardClick,
  navFilter,
  setNavFilter,
}: {
  onAdd: (item: Product) => void;
  onCardClick: (item: Product) => void;
  navFilter: NavFilter | null;
  setNavFilter: (f: NavFilter | null) => void;
}) {
  const isMobile = useIsMobile();
  const cats = useCategories();
  const [selected, setSelected] = useState<string[]>([]); // обрані інгредієнти (мультивибір)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);

  // при зміні категорії скидаємо інгредієнт-фільтр
  useEffect(() => { setSelected([]); }, [navFilter]);

  const toggle = (ing: string) =>
    setSelected((prev) => (prev.includes(ing) ? prev.filter((x) => x !== ing) : [...prev, ing]));

  const items = useMemo(() => {
    let list = MENU;
    if (navFilter) {
      if (navFilter.category) list = list.filter((m) => m.category === navFilter.category);
      else if (navFilter.badge) list = list.filter((m) => m.badge === navFilter.badge);
    }
    if (selected.length) {
      // товар має містити ВСІ обрані інгредієнти
      list = list.filter((m) => selected.every((s) => m.ingredients.includes(s.toLowerCase())));
    }
    return list;
  }, [selected, navFilter]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [selected, navFilter]);

  const shown = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const title = navFilter?.category
    ? cats.find((c) => c.slug === navFilter.category)?.name ?? "Меню"
    : navFilter?.badge === "НОВЕ"
      ? "Новинки"
      : "Повне меню";

  const Chips = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button onClick={() => setSelected([])} className={`chip ${selected.length === 0 ? "active" : ""}`}>
        Всі
      </button>
      {INGREDIENTS.map((f) => (
        <button key={f} onClick={() => toggle(f)} className={`chip ${selected.includes(f) ? "active" : ""}`}>
          {f}
        </button>
      ))}
    </div>
  );

  return (
    <section id="menu" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--head-mb)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
              {title}
            </h2>
            {navFilter && (
              <button
                onClick={() => setNavFilter(null)}
                style={{
                  background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-secondary)",
                  padding: "8px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Усе меню ×
              </button>
            )}
          </div>
        </div>

        {/* чіпи інгредієнтів — інлайн лише на десктопі; на мобільному в FAB-листі */}
        {!isMobile && <div style={{ marginBottom: 40 }}>{Chips}</div>}

        {items.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22 }}>Нічого не знайдено за цим фільтром</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: 20 }}>
              {shown.map((item) => (
                <MenuCard key={item.id} item={item} onAdd={onAdd} onClick={() => onCardClick(item)} />
              ))}
            </div>

            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
                <button className="btn-secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Завантажити більше
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Мобільний фільтр: FAB + нижній лист ===== */}
      {isMobile && (
        <>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Фільтри"
            style={{
              position: "fixed", right: 14, bottom: 78, zIndex: 95,
              height: 40, padding: "0 13px", borderRadius: 20,
              background: "var(--accent)", color: "#0A0908", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
              fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase",
            }}
          >
            <FilterIcon />
            Фільтр{selected.length ? ` · ${selected.length}` : ""}
          </button>

          {sheetOpen && (
            <>
              {/* клік по фону закриває лист */}
              <div className="fade-in" onClick={() => setSheetOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120 }} />
              <div
                style={{
                  position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 121,
                  background: "var(--bg-card)", borderTop: "1px solid var(--border-light)",
                  borderRadius: "16px 16px 0 0", padding: "20px 20px 24px",
                  animation: "fadeUp 0.25s ease both",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                    Фільтр за інгредієнтами
                  </span>
                  <button onClick={() => setSheetOpen(false)} aria-label="Закрити"
                    style={{ width: 36, height: 36, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>

                {Chips}

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button className="btn-secondary" style={{ flex: "0 0 auto" }} onClick={() => setSelected([])}>
                    Скинути
                  </button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => setSheetOpen(false)}>
                    Готово{items.length ? ` · ${items.length}` : ""}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
