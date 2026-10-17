"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowBtn from "./ArrowBtn";
import RailCard from "./RailCard";
import RollDot from "./RollDot";
import { usePublicCatalog } from "@/features/publicData";
import { peekHomeRestore, isHomeRestoring, saveHomeState } from "@/features/navHistory";
import type { Product } from "@/lib/types";

/** «Новинки / Хіти / Акції» — стрічка на всю ширину екрана, що гортається вбік
 *  (свайп на телефоні; на ПК — стрілки, колесо/тачпад або перетягування мишею). */
export default function Hits({
  onAdd,
  onCardClick,
}: {
  onAdd: (item: Product) => void;
  /** list — товари активної вкладки (для свайпу між ними в модалці) */
  onCardClick: (item: Product, list: Product[]) => void;
}) {
  const catalog = usePublicCatalog();

  // три вкладки зі своїми наборами товарів
  const tabs = useMemo(() => {
    return [
      { key: "new", label: "Новинки", items: catalog.filter((m) => m.badge === "НОВЕ") },
      { key: "hit", label: "Хіти", items: catalog.filter((m) => m.badge === "ХІТ") },
      { key: "promo", label: "Акції", items: catalog.filter((m) => m.oldPrice != null) },
    ];
  }, [catalog]);

  const [tabIdx, setTabIdx] = useState(0);

  // повернулися «назад» — та сама вкладка
  useEffect(() => {
    const t = peekHomeRestore()?.hitsTab;
    if (t != null) setTabIdx(t);
  }, []);
  useEffect(() => { if (!isHomeRestoring()) saveHomeState({ hitsTab: tabIdx }); }, [tabIdx]);

  // стартова вкладка — перша непорожня (щоб не відкривалась порожня)
  useEffect(() => {
    if (isHomeRestoring()) return;
    if (tabs[tabIdx]?.items.length === 0) {
      const first = tabs.findIndex((t) => t.items.length > 0);
      if (first >= 0) setTabIdx(first);
    }
    // лише при зміні набору товарів; ручний вибір порожньої вкладки не чіпаємо
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  // ---- стрічка: прогрес, стрілки, перетягування мишею ----
  const railRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false, progress: 0, fits: true });
  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4, progress: max > 0 ? el.scrollLeft / max : 0, fits: max <= 4 });
  }, []);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollLeft = 0; // нова вкладка — з початку
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabIdx, measure]);

  // точка → прокрутити стрічку до цієї картки
  const scrollToCard = (i: number) => {
    const el = railRef.current;
    const card = el?.children[i] as HTMLElement | undefined;
    // відстань від першої картки = скільки прокрутити (перша стоїть на лінії вкладок)
    if (el && card) el.scrollTo({ left: card.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: "smooth" });
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // мишею можна тягнути стрічку; після перетягування клік по картці не спрацьовує
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !railRef.current) return;
    drag.current = { x: e.clientX, left: railRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, el = railRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; el.classList.add("dragging"); }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    railRef.current?.classList.remove("dragging");
    if (d?.moved) {
      // гасимо клік, який браузер надішле після відпускання кнопки
      const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    }
  };

  // якщо порожньо геть усюди — секцію не показуємо
  if (tabs.every((t) => t.items.length === 0)) return null;

  const items = tabs[tabIdx].items;

  return (
    <section id="hits" style={{ padding: "var(--py) 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ padding: "0 var(--page-pad)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--head-mb)", gap: 16, flexWrap: "wrap" }}>
          {/* перемикач вкладок — кнопки в квадратній рамці (як «Фільтри/Сортування»), трохи більший шрифт */}
          <div className="rail-tabs">
            {tabs.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setTabIdx(i)}
                className={`chip square rail-tab ${i === tabIdx ? "active" : ""}`}
              >
                {t.label}
                {t.items.length > 0 && <span className="rail-count">{t.items.length}</span>}
              </button>
            ))}
          </div>
          {!edge.fits && (
            <div className="rail-arrows" style={{ display: "flex", gap: 8 }}>
              <span style={{ opacity: edge.start ? 0.35 : 1, pointerEvents: edge.start ? "none" : undefined }}><ArrowBtn dir="left" onClick={() => scrollBy(-1)} /></span>
              <span style={{ opacity: edge.end ? 0.35 : 1, pointerEvents: edge.end ? "none" : undefined }}><ArrowBtn dir="right" onClick={() => scrollBy(1)} /></span>
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 15, opacity: 0.8, padding: "8px var(--page-pad)", maxWidth: 1440, margin: "0 auto" }}>Поки немає товарів у цій категорії.</p>
      ) : (
        <>
          <div
            ref={railRef}
            key={tabIdx}
            className={`rail fade-in${edge.start ? "" : " fade-l"}${edge.end ? "" : " fade-r"}`}
            onScroll={measure}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            {items.map((item) => (
              <RailCard key={item.id} item={item} onAdd={onAdd} onClick={() => onCardClick(item, items)} />
            ))}
          </div>
          {!edge.fits && (
            <div className="rail-dots">
              {items.map((item, i) => {
                // активна — картка, до якої докрутили (прогрес прокрутки → номер картки)
                const active = i === Math.round(edge.progress * (items.length - 1));
                return (
                  <button key={item.id} className={`rail-dot${active ? " active" : ""}`}
                    aria-label={`${item.name} (${i + 1} з ${items.length})`} aria-current={active || undefined}
                    onClick={() => scrollToCard(i)}>
                    <RollDot />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
