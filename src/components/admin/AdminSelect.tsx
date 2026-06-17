"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "@/components/admin/admin.module.css";

export interface AdminSelectOption { value: string; label: string; }

const PANEL_MAX = 320;

// Кастомний випадаючий список у стилі сайту: з пошуком, своєю прокруткою
// (без багів нативного <select>) і клавіатурою. Рендериться у portal поверх
// усього — не обрізається скролом модалки; авто-розворот угору за браком місця.
export default function AdminSelect({
  value, onChange, options, placeholder = "Оберіть…", searchPlaceholder = "Пошук…",
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // позиціонування панелі під/над кнопкою (fixed, у координатах вʼюпорта)
  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const up = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(PANEL_MAX, Math.max(160, up ? spaceAbove : spaceBelow));
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, maxHeight, up });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); };
  }, [open]);

  // закриття по кліку поза тригером і панеллю + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // при відкритті — фокус на пошук, скидання запиту, підсвітка обраного
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, options, value]);

  // тримаємо активний пункт у зоні видимості
  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[active]; if (o) choose(o.value); }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={s.input}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", cursor: "pointer", fontSize: 13 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: current ? "var(--text-primary)" : "var(--text-secondary)" }}>
          {current?.label ?? placeholder}
        </span>
        <span style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", color: "var(--text-secondary)", fontSize: 11 }}>▾</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: "fixed", left: pos.left, width: pos.width, zIndex: 1000,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            maxHeight: pos.maxHeight,
            background: "var(--bg-card, #15110E)", border: "1px solid var(--border-light, rgba(255,255,255,0.16))",
            borderRadius: 10, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", padding: 6,
            display: "flex", flexDirection: "column",
          }}
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder={searchPlaceholder}
            className={s.input}
            style={{ fontSize: 13, padding: "8px 10px", marginBottom: 6, flexShrink: 0 }}
          />
          <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-secondary)" }}>Нічого не знайдено</div>
            ) : filtered.map((o, i) => {
              const selected = o.value === value;
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
                    border: "none", borderRadius: 6, cursor: "pointer", padding: "8px 10px", fontSize: 13,
                    fontFamily: "var(--font-body)", lineHeight: 1.3,
                    background: hl ? "var(--bg-elevated, rgba(255,255,255,0.06))" : "transparent",
                    color: selected ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  <span style={{ width: 12, flexShrink: 0, color: "var(--accent)" }}>{selected ? "✓" : ""}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
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
