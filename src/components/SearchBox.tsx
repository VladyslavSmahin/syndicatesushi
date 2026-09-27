"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { usePublicCatalog } from "@/features/publicData";
import type { Product } from "@/lib/types";
import { useScrollLock } from "@/lib/scrollLock";
import ThumbImg from "./ThumbImg";

const MAX_RESULTS = 8;

// нижній регістр + єдиний апостроф (ʼ ’ ' `), щоб «імбирʼ» знаходило «імбир'»
const norm = (s: string) => s.toLowerCase().replace(/[ʼ’'`]/g, "'").replace(/\s+/g, " ").trim();

/** Пошук страв за назвою: іконка в шапці → панель під шапкою з полем і випадайкою збігів. */
export default function SearchBox({ onOpen }: { onOpen: (item: Product, list: Product[]) => void }) {
  const catalog = usePublicCatalog();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0); // підсвічений рядок (клавіатура)
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    const scored: { p: Product; rank: number }[] = [];
    for (const p of catalog) {
      const name = norm(p.name);
      const i = name.indexOf(nq);
      if (i < 0) continue;
      // з початку назви → з початку слова → будь-де
      const rank = i === 0 ? 0 : name[i - 1] === " " ? 1 : 2;
      scored.push({ p, rank });
    }
    return scored.sort((a, b) => a.rank - b.rank).map((x) => x.p);
  }, [catalog, q]);

  const shown = results.slice(0, MAX_RESULTS);

  useScrollLock(open);
  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // клік поза панеллю — закриваємо
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const pick = (item: Product) => {
    setOpen(false);
    setQ("");
    onOpen(item, results);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % shown.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + shown.length) % shown.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(shown[active]); }
  };

  return (
    <div ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Пошук"
        aria-expanded={open}
        className="header-icon-btn"
        style={{ background: open ? "var(--bg-elevated)" : "transparent" }}
      >
        {open ? <Icon.Close width="16" height="16" /> : <SearchIcon />}
      </button>

      {open && (
        <div className="search-panel fade-in">
          <div className="search-inner">
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", display: "flex" }}>
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                className="form-input"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Пошук страви…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                style={{ paddingLeft: 44, fontSize: 16 /* 16px — iOS не зумить при фокусі */ }}
                aria-label="Пошук страви"
              />
            </div>

            {q.trim() !== "" && (
              <div className="search-results" role="listbox">
                {shown.length === 0 ? (
                  <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--text-secondary)" }}>Нічого не знайдено</div>
                ) : (
                  shown.map((p, i) => (
                    <button
                      key={p.id}
                      role="option"
                      aria-selected={i === active}
                      className={`search-row ${i === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(p)}
                    >
                      <span className="mini-thumb">
                        {p.photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <ThumbImg src={p.photo} alt="" loading="lazy" />
                        )}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </span>
                        {p.weight && <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 0.8 }}>{p.weight}</span>}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: p.oldPrice ? "var(--accent)" : "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {p.price} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)" }}>грн</span>
                      </span>
                    </button>
                  ))
                )}
                {results.length > MAX_RESULTS && (
                  <div style={{ padding: "10px 14px", fontSize: 11, letterSpacing: 1, color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
                    Ще {results.length - MAX_RESULTS} — уточніть запит
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
    </svg>
  );
}
