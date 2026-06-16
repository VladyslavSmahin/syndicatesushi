"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MenuCard from "./MenuCard";
import { usePublicCatalog, usePublicCategories, usePublicSubcategories, useGloss } from "@/features/publicData";
import { useIsMobile } from "@/features/useIsMobile";
import type { Product, NavCategory } from "@/lib/types";

type NavFilter = NonNullable<NavCategory["filter"]>;

// скільки товарів вантажимо за раз: мобілка (2 кол.) — 10, десктоп (4/3 кол.) — 12 (повні ряди)
const PAGE_MOBILE = 10;
const PAGE_DESKTOP = 12;
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
  const glossNovynky = useGloss("nav_novynky");
  const glossFullMenu = useGloss("title_full_menu");
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
  const pageSize = isMobile ? PAGE_MOBILE : PAGE_DESKTOP;
  const [visibleCount, setVisibleCount] = useState(PAGE_DESKTOP);
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

  useEffect(() => { setVisibleCount(pageSize); }, [selected, selectedSub, navFilter, pageSize]);

  const shown = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const title = navFilter?.category
    ? cats.find((c) => c.slug === navFilter.category)?.name ?? "Меню"
    : navFilter?.badge === "НОВЕ"
      ? glossNovynky
      : glossFullMenu;

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
            <h2 className="section-title" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
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
                <button className="btn-secondary" onClick={() => setVisibleCount((c) => c + pageSize)}>
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

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "default", label: "Сортування" },
  { value: "price-asc", label: "Ціна: спочатку дешевші" },
  { value: "price-desc", label: "Ціна: спочатку дорожчі" },
  { value: "weight-asc", label: "Вага: спочатку менші" },
  { value: "weight-desc", label: "Вага: спочатку більші" },
];

function SortControl({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = sort !== "default";
  const current = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`chip square ${active ? "active" : ""}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        {current.label}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, minWidth: 240,
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)", padding: 6,
          }}
        >
          {SORT_OPTIONS.map((o) => {
            const selected = o.value === sort;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { setSort(o.value); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "10px 12px", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 1.5,
                  textTransform: "uppercase", color: selected ? "var(--accent)" : "var(--text-secondary)",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; if (!selected) e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; if (!selected) e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <span style={{ width: 14, flexShrink: 0, color: "var(--accent)" }}>{selected ? "✓" : ""}</span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
