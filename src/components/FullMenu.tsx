"use client";

import { useEffect, useMemo, useState } from "react";
import MenuCard from "./MenuCard";
import { usePublicCatalog, usePublicCategories, usePublicSubcategories } from "@/features/publicData";
import { useIsMobile } from "@/features/useIsMobile";
import type { Product, NavCategory } from "@/lib/types";

type NavFilter = NonNullable<NavCategory["filter"]>;

const PAGE_SIZE = 6;
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);

type Sort = "default" | "price-asc" | "price-desc" | "weight-asc" | "weight-desc";
const parseWeight = (w: string) => {
  const m = (w || "").replace(",", ".").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
};

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
  const catalog = usePublicCatalog();
  const cats = usePublicCategories();
  // список інгредієнтів для фільтра — динамічно з каталогу (унікальні назви)
  const INGREDIENTS = useMemo(() => {
    const set = new Set<string>();
    for (const m of catalog) for (const i of m.ingredients) set.add(i);
    return [...set].sort((a, b) => a.localeCompare(b, "uk")).map(cap);
  }, [catalog]);
  // підкатегорії активної категорії (напр. типи ролів для «роли»).
  // Показуємо лише коли вибрана конкретна категорія — не на «Повне меню»/«Новинки».
  const catSubs = usePublicSubcategories(navFilter?.category);
  const subcats = navFilter?.category ? catSubs : [];
  const [selected, setSelected] = useState<string[]>([]); // обрані інгредієнти (мультивибір)
  const [selectedSub, setSelectedSub] = useState<string | null>(null); // обрана підкатегорія
  const [sort, setSort] = useState<Sort>("default"); // сортування
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // десктоп: розкриті чипи інгредієнтів

  // при зміні категорії скидаємо інгредієнт-фільтр і підкатегорію
  useEffect(() => { setSelected([]); setSelectedSub(null); }, [navFilter]);

  const toggle = (ing: string) =>
    setSelected((prev) => (prev.includes(ing) ? prev.filter((x) => x !== ing) : [...prev, ing]));

  const items = useMemo(() => {
    let list = catalog;
    if (navFilter) {
      if (navFilter.category) list = list.filter((m) => m.category === navFilter.category);
      else if (navFilter.badge) list = list.filter((m) => m.badge === navFilter.badge);
    }
    if (selectedSub) list = list.filter((m) => m.subcategory === selectedSub);
    if (selected.length) {
      // товар має містити ВСІ обрані інгредієнти
      list = list.filter((m) => selected.every((s) => m.ingredients.includes(s.toLowerCase())));
    }
    if (sort !== "default") {
      const dir = sort.endsWith("asc") ? 1 : -1;
      const val = sort.startsWith("price") ? (p: Product) => p.price : (p: Product) => parseWeight(p.weight);
      list = [...list].sort((a, b) => {
        const av = val(a), bv = val(b), an = Number.isNaN(av), bn = Number.isNaN(bv);
        if (an && bn) return 0;
        if (an) return 1;   // без числової ваги — у кінець
        if (bn) return -1;
        return (av - bv) * dir;
      });
    }
    return list;
  }, [catalog, selected, selectedSub, navFilter, sort]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [selected, selectedSub, navFilter]);

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
    <section id="menu" style={{ padding: "32px var(--page-pad) var(--py)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
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

        {/* десктоп: кнопка «Фільтри» зліва — чипи інгредієнтів сховані, відкриваються по кліку.
            На мобільному фільтри в FAB-листі. */}
        {!isMobile && (
          <div style={{ marginBottom: subcats.length ? 16 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`chip square ${selected.length ? "active" : ""}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <FilterIcon />
                Фільтри{selected.length ? ` · ${selected.length}` : ""}
              </button>
              <SortControl sort={sort} setSort={setSort} />
            </div>
            {filtersOpen && <div style={{ marginTop: 14 }}>{Chips}</div>}
          </div>
        )}

        {/* навігація по підкатегоріях активної категорії (напр. типи ролів) */}
        {subcats.length > 0 && (
          <div className="subcat-row" style={{ marginBottom: 28 }}>
            <button
              onClick={() => setSelectedSub(null)}
              className={`chip square ${selectedSub === null ? "active" : ""}`}
            >
              Всі
            </button>
            {subcats.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setSelectedSub(sc.slug)}
                className={`chip square ${selectedSub === sc.slug ? "active" : ""}`}
              >
                {sc.name}
              </button>
            ))}
          </div>
        )}

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

                <div style={{ marginBottom: 16 }}>
                  <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Сортування</span>
                  <SortControl sort={sort} setSort={setSort} />
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

function SortControl({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  return (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as Sort)}
      aria-label="Сортування"
      style={{
        background: "var(--bg-elevated)", color: sort === "default" ? "var(--text-secondary)" : "var(--text-primary)",
        border: `1px solid ${sort === "default" ? "var(--border-light)" : "var(--accent)"}`,
        padding: "10px 14px", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
        fontFamily: "var(--font-body)", cursor: "pointer",
      }}
    >
      <option value="default">Сортування</option>
      <option value="price-asc">Ціна: спочатку дешевші</option>
      <option value="price-desc">Ціна: спочатку дорожчі</option>
      <option value="weight-asc">Вага: спочатку менші</option>
      <option value="weight-desc">Вага: спочатку більші</option>
    </select>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
