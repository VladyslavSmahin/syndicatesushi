"use client";

import { useMemo, useState } from "react";
import ArrowBtn from "./ArrowBtn";
import MenuCard from "./MenuCard";
import { MENU } from "@/data/site";
import { useIsMobile } from "@/features/useIsMobile";
import type { Product } from "@/lib/types";

export default function Hits({
  onAdd,
  onCardClick,
}: {
  onAdd: (item: Product) => void;
  onCardClick: (item: Product) => void;
}) {
  const isMobile = useIsMobile();
  const hits = useMemo(() => MENU.filter((m) => m.isHit), []);
  const perPage = 4;
  const pages = Math.ceil(hits.length / perPage);
  const [page, setPage] = useState(0);
  // на мобільному показуємо всі хіти списком, без слайдера
  const visible = isMobile ? hits : hits.slice(page * perPage, page * perPage + perPage);

  const prev = () => setPage((p) => (p - 1 + pages) % pages);
  const next = () => setPage((p) => (p + 1) % pages);

  return (
    <section id="hits" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--head-mb)", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Найпопулярніше</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
              Хіти меню
            </h2>
          </div>
          {!isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <ArrowBtn dir="left" onClick={prev} />
              <ArrowBtn dir="right" onClick={next} />
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: 20 }}>
          {visible.map((item) => (
            <MenuCard key={item.id} item={item} onAdd={onAdd} onClick={() => onCardClick(item)} />
          ))}
        </div>

        {!isMobile && pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 40 }}>
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Сторінка ${i + 1}`}
                style={{
                  width: i === page ? 24 : 8, height: 8, borderRadius: 4,
                  background: i === page ? "var(--accent)" : "var(--border-light)",
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
