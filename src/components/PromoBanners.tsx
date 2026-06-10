"use client";

import { useState } from "react";
import ArrowBtn from "./ArrowBtn";
import { PROMOS } from "@/data/site";
import type { Promo } from "@/lib/types";

function PromoCard({ promo, highlighted, onOrder }: { promo: Promo; highlighted: boolean; onOrder: () => void }) {
  return (
    <div
      onClick={onOrder}
      style={{
        position: "relative", aspectRatio: "16 / 9", cursor: "pointer", overflow: "hidden", background: "#0A0908",
        transition: "transform 0.3s, box-shadow 0.3s",
        boxShadow: highlighted ? "0 0 0 1px var(--accent), 0 12px 40px rgba(0,0,0,0.5)" : "0 6px 24px rgba(0,0,0,0.35)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={promo.bannerImage} alt={promo.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

export default function PromoBanners({ onOrder }: { onOrder: (p: Promo) => void }) {
  const [idx, setIdx] = useState(0);
  const total = PROMOS.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  return (
    <section id="promos" style={{ padding: "var(--py) var(--page-pad)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--head-mb)", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Спеціально для вас</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
              Акційні пропозиції
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <ArrowBtn dir="left" onClick={prev} />
            <ArrowBtn dir="right" onClick={next} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "var(--promo-cols)", gap: 22 }}>
          {PROMOS.map((p, i) => (
            <PromoCard key={p.id} promo={p} highlighted={i === idx} onOrder={() => onOrder(p)} />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 36 }}>
          {PROMOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Банер ${i + 1}`}
              style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
                background: i === idx ? "var(--accent)" : "var(--border-light)",
                border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
