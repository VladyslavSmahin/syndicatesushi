"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "@/components/admin/admin.module.css";

export interface AdminSelectOption { value: string; label: string; hint?: string; }

const PANEL_MAX = 340;
const PANEL_MIN_W = 220;
const GUTTER = 10;          // мінімальний відступ панелі від краю екрана
const SEARCH_FROM = 8;      // з якої кількості пунктів показувати пошук

// Кастомний випадаючий список у стилі сайту: з пошуком, своєю прокруткою
// (без багів нативного <select>) і клавіатурою. Рендериться у portal поверх
// усього — не обрізається скролом модалки; авто-розворот угору за браком місця
// і притискання до вьюпорта, щоб панель ніколи не «їхала» за край екрана.
export default function AdminSelect({
  value, onChange, options, placeholder = "Оберіть…", searchPlaceholder = "Пошук…",
  disabled = false, keepOpen = false, resetOnPick = false, buttonLabel,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** не закривати панель після вибору (зручно додавати кілька пунктів поспіль) */
  keepOpen?: boolean;
  /** після вибору не показувати обране на кнопці (режим «додати пункт») */
  resetOnPick?: boolean;
  /** свій підпис кнопки замість обраного значення */
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; up: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const withSearch = options.length >= SEARCH_FROM;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // позиціонування панелі під/над кнопкою (fixed, у координатах вʼюпорта)
  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const spaceBelow = window.innerHeight - r.bottom - GUTTER;
    const spaceAbove = r.top - GUTTER;
    const up = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(PANEL_MAX, Math.max(160, up ? spaceAbove : spaceBelow));
    // ширина — як у кнопки, але не вужче PANEL_MIN_W і не ширше екрана
    const width = Math.min(Math.max(r.width, PANEL_MIN_W), window.innerWidth - GUTTER * 2);
    // притискаємо до вьюпорта, щоб панель не вилазила за правий/лівий край
    const left = Math.min(Math.max(GUTTER, r.left), window.innerWidth - width - GUTTER);
    const next = { left, top: up ? r.top - 6 : r.bottom + 6, width, maxHeight, up };
    setPos((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.width === next.width
        && prev.maxHeight === next.maxHeight && prev.up === next.up
        ? prev
        : next
    );
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Кнопка може поїхати не лише від скролу: у режимі keepOpen вибір пункту
    // додає рядок і зсуває всю форму. Тому стежимо за нею щокадру — стан
    // оновлюється тільки коли координати справді змінились.
    let raf = 0;
    const tick = () => { reposition(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // закриття по кліку поза тригером і панеллю + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // не даємо Escape дійти до модалки — інакше закриється вся форма
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // при відкритті — фокус на пошук, скидання запиту, підсвітка обраного.
  // Залежність лише від `open`: масив options часто новий на кожен рендер, і
  // з ним у списку залежностей пошук скидався просто від набору тексту.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    if (withSearch) setTimeout(() => searchRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // тримаємо активний пункт у зоні видимості
  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string) => {
    onChange(v);
    if (keepOpen) { setQuery(""); setActive(0); searchRef.current?.focus(); }
    else setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[active]; if (o) choose(o.value); }
  };

  const label = buttonLabel ?? (resetOnPick ? placeholder : current?.label ?? placeholder);
  const muted = buttonLabel ? false : resetOnPick || !current;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={s.input}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (!withSearch) onKey(e); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          borderColor: open ? "var(--accent)" : undefined,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: muted ? "var(--text-secondary)" : "var(--text-primary)" }}>
          {label}
        </span>
        <Chevron open={open} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="fade-in"
          style={{
            position: "fixed", left: pos.left, width: pos.width, zIndex: 1200,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            maxHeight: pos.maxHeight,
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.65)", padding: 6,
            display: "flex", flexDirection: "column", overscrollBehavior: "contain",
          }}
        >
          {withSearch && (
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              className={s.input}
              style={{ fontSize: 13, padding: "8px 10px", marginBottom: 6, flexShrink: 0 }}
            />
          )}
          <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-secondary)" }}>Нічого не знайдено</div>
            ) : filtered.map((o, i) => {
              const selected = o.value === value && !resetOnPick;
              const hl = i === active;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                    border: "none", borderRadius: 6, cursor: "pointer", padding: "9px 10px", fontSize: 13,
                    fontFamily: "var(--font-body)", lineHeight: 1.3,
                    background: hl ? "var(--bg-elevated)" : "transparent",
                    color: selected ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  <span style={{ width: 12, flexShrink: 0, color: "var(--accent)" }}>{selected ? "✓" : ""}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                  {o.hint && (
                    <span style={{ flexShrink: 0, fontSize: 11, color: "var(--text-secondary)" }}>{o.hint}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
