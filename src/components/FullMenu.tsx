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

  // мобільна панель фільтрів: блокуємо скрол сторінки під нею + закриття по Esc
  useEffect(() => {
    if (!sheetOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [sheetOpen]);

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

        {/* активні фільтри — видно після закриття панелі, кожен знімається кліком */}
        {selected.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 20 }}>
            {selected.map((s) => (
              <button
                key={s}
                onClick={() => toggle(s)}
                aria-label={`Прибрати фільтр ${s}`}
                className="chip active"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {s}
                <span aria-hidden style={{ fontSize: 13, lineHeight: 1, opacity: 0.7 }}>×</span>
              </button>
            ))}
            <button
              onClick={() => setSelected([])}
              style={{
                background: "transparent", border: "none", cursor: "pointer", padding: "0 4px",
                fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
                color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 3,
              }}
            >
              Очистити все
            </button>
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

      {/* ===== Мобільний фільтр: FAB зліва + бічна панель справа ===== */}
      {isMobile && (
        <>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Фільтри"
            style={{
              position: "fixed", left: "var(--fab-left, 14px)", bottom: "var(--fab-bottom, 78px)", zIndex: 95,
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
              <aside
                role="dialog"
                aria-modal="true"
                aria-label="Фільтри"
                style={{
                  position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 121,
                  width: "min(88vw, 380px)", maxWidth: "100%",
                  background: "var(--bg-card)", borderLeft: "1px solid var(--border-light)",
                  display: "flex", flexDirection: "column",
                  animation: "slideInRight 0.28s ease both",
                }}
              >
                {/* шапка — прибита зверху */}
                <div style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "16px 18px", borderBottom: "1px solid var(--border)",
                }}>
                  <button onClick={() => setSheetOpen(false)} aria-label="Закрити"
                    style={{ width: 36, height: 36, flexShrink: 0, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                    Фільтри
                  </span>
                </div>

                {/* тіло — єдина зона, що скролиться */}
                <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 18 }}>
                  <span className="eyebrow" style={{ display: "block", marginBottom: 10 }}>Сортування</span>
                  <div style={{ marginBottom: 24 }}>
                    <SortControl sort={sort} setSort={setSort} full />
                  </div>

                  <span className="eyebrow" style={{ display: "block", marginBottom: 10 }}>Інгредієнти</span>
                  <IngredientPicker options={INGREDIENTS} selected={selected} toggle={toggle} clear={() => setSelected([])} />
                </div>

                {/* дії — прибиті знизу, з урахуванням safe-area на iOS */}
                <div style={{
                  flexShrink: 0, display: "flex", gap: 10,
                  padding: "14px 18px calc(14px + env(safe-area-inset-bottom, 0px))",
                  borderTop: "1px solid var(--border)", background: "var(--bg-card)",
                }}>
                  <button className="btn-secondary" style={{ flex: "0 0 auto" }} onClick={() => { setSelected([]); setSort("default"); }}>
                    Скинути
                  </button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => setSheetOpen(false)}>
                    Готово{items.length ? ` · ${items.length}` : ""}
                  </button>
                </div>
              </aside>
            </>
          )}
        </>
      )}
    </section>
  );
}

// label — текст на кнопці, menuLabel — у списку (щоб «Сортування» не дублювалось саме з собою)
const SORT_OPTIONS: { value: Sort; label: string; menuLabel?: string }[] = [
  { value: "default", label: "Сортування", menuLabel: "За замовчуванням" },
  { value: "price-asc", label: "Ціна: спочатку дешевші" },
  { value: "price-desc", label: "Ціна: спочатку дорожчі" },
  { value: "weight-asc", label: "Вага: спочатку менші" },
  { value: "weight-desc", label: "Вага: спочатку більші" },
];

function SortControl({ sort, setSort, full = false }: { sort: Sort; setSort: (s: Sort) => void; full?: boolean }) {
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
    <div ref={ref} style={{ position: "relative", width: full ? "100%" : undefined }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`chip square ${active ? "active" : ""}`}
        style={{
          display: full ? "flex" : "inline-flex", alignItems: "center", gap: 8,
          width: full ? "100%" : undefined, justifyContent: full ? "space-between" : undefined, textAlign: "left",
        }}
      >
        {current.label}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
            minWidth: full ? undefined : 240, width: full ? "100%" : undefined,
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
                {o.menuLabel ?? o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Мультивибір інгредієнтів: згорнутий дропдаун з пошуком + обрані чипами під ним. */
function IngredientPicker({
  options,
  selected,
  toggle,
  clear,
}: {
  options: string[];
  selected: string[];
  toggle: (ing: string) => void;
  clear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  return (
    <div>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`chip square ${selected.length ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left" }}
        >
          {selected.length ? `Обрано · ${selected.length}` : "Обрати інгредієнти"}
          <Chevron open={open} />
        </button>

        {open && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, width: "100%", zIndex: 60,
              background: "var(--bg-card)", border: "1px solid var(--border-light)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", maxHeight: 300,
            }}
          >
            <div style={{ flexShrink: 0, padding: 8, borderBottom: "1px solid var(--border)" }}>
              {/* без autoFocus: на мобілці клавіатура з'їдала б половину списку одразу при відкритті */}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук інгредієнта…"
                aria-label="Пошук інгредієнта"
                style={{
                  width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
                  border: "1px solid var(--border-light)", color: "var(--text-primary)",
                  fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: 0.5, outline: "none",
                }}
              />
            </div>

            <div role="listbox" aria-multiselectable style={{ flex: 1, overflowY: "auto", padding: 6 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "14px 12px", fontSize: 11, letterSpacing: 1, color: "var(--text-secondary)" }}>
                  Нічого не знайдено
                </div>
              ) : (
                filtered.map((o) => {
                  const on = selected.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(o)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                        background: "transparent", border: "none", cursor: "pointer",
                        padding: "10px 12px", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 1.5,
                        textTransform: "uppercase", color: on ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      <span style={{ width: 14, flexShrink: 0, color: "var(--accent)" }}>{on ? "✓" : ""}</span>
                      {o}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* обрані інгредієнти — знімаються кліком */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
          {selected.map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              aria-label={`Прибрати ${s}`}
              className="chip active"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {s}
              <span aria-hidden style={{ fontSize: 13, lineHeight: 1, opacity: 0.7 }}>×</span>
            </button>
          ))}
          <button
            onClick={clear}
            style={{
              background: "transparent", border: "none", cursor: "pointer", padding: "0 4px",
              fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
              color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            Очистити
          </button>
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
