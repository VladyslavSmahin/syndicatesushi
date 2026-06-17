"use client";

import { useEffect, useMemo, useState } from "react";
import ArrowBtn from "./ArrowBtn";
import MenuCard from "./MenuCard";
import { usePublicCatalog } from "@/features/publicData";
import { useIsMobile } from "@/features/useIsMobile";
import type { Product } from "@/lib/types";

const PER_PAGE = 4;

export default function Hits({
  onAdd,
  onCardClick,
}: {
  onAdd: (item: Product) => void;
  onCardClick: (item: Product) => void;
}) {
  const isMobile = useIsMobile();
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
  const [page, setPage] = useState(0);

  // стартова вкладка — перша непорожня (щоб не відкривалась порожня)
  useEffect(() => {
    if (tabs[tabIdx]?.items.length === 0) {
      const first = tabs.findIndex((t) => t.items.length > 0);
      if (first >= 0) setTabIdx(first);
    }
    // лише при зміні набору товарів; ручний вибір порожньої вкладки не чіпаємо
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  // якщо порожньо геть усюди — секцію не показуємо
  if (tabs.every((t) => t.items.length === 0)) return null;

  const active = tabs[tabIdx];
  const items = active.items;
  const pages = Math.ceil(items.length / PER_PAGE);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  // на мобільному показуємо всі товари вкладки списком, без слайдера
  const visible = isMobile ? items : items.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const selectTab = (i: number) => { setTabIdx(i); setPage(0); };
  const prev = () => setPage((p) => (p - 1 + pages) % pages);
  const next = () => setPage((p) => (p + 1) % pages);

  return (
    <section id="hits" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--head-mb)", gap: 16, flexWrap: "wrap" }}>
          {/* перемикач вкладок — кнопки в квадратній рамці (як «Фільтри/Сортування»), трохи більший шрифт */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {tabs.map((t, i) => {
              const on = i === tabIdx;
              return (
                <button
                  key={t.key}
                  onClick={() => selectTab(i)}
                  className={`chip square ${on ? "active" : ""}`}
                  style={{ fontSize: 14, padding: "11px 22px", letterSpacing: 1.4 }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {!isMobile && pages > 1 && (
            <div style={{ display: "flex", gap: 8 }}>
              <ArrowBtn dir="left" onClick={prev} />
              <ArrowBtn dir="right" onClick={next} />
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 15, opacity: 0.8, padding: "8px 0" }}>Поки немає товарів у цій категорії.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: 20 }}>
            {visible.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={onAdd} onClick={() => onCardClick(item)} compact />
            ))}
          </div>
        )}

        {!isMobile && pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 40 }}>
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Сторінка ${i + 1}`}
                style={{
                  width: i === safePage ? 24 : 8, height: 8, borderRadius: 4,
                  background: i === safePage ? "var(--accent)" : "var(--border-light)",
                  border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
