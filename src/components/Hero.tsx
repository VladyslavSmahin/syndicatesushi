"use client";

import HeroPromoSlider from "./HeroPromoSlider";
import { CONTACTS, TEXTS } from "@/data/site";
import type { Promo } from "@/lib/types";

export default function Hero({
  onCtaOrder,
  onCtaMenu,
  onPromoOrder,
}: {
  onCtaOrder: () => void;
  onCtaMenu: () => void;
  onPromoOrder: (p: Promo) => void;
}) {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        padding: "var(--hero-pt) var(--page-pad) var(--py)",
        background: "linear-gradient(135deg, #4A2E1A 0%, #2A1A10 35%, #1A130D 65%, #0D0B09 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute", top: "-20%", right: "-10%", width: "70%", height: "120%",
          background: "radial-gradient(ellipse at top right, rgba(180,120,70,0.45) 0%, rgba(120,70,40,0.18) 30%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 0%, rgba(13,11,9,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          maxWidth: 1440, margin: "0 auto", display: "grid",
          gridTemplateColumns: "var(--hero-cols)", gap: 80, alignItems: "center", position: "relative",
        }}
      >
        {/* left */}
        <div className="fade-up hero-copy">
          <div className="eyebrow" style={{ marginBottom: 28, fontSize: 15, letterSpacing: 4 }}>{CONTACTS.addressShort}</div>
          <h1
            style={{
              fontFamily: "var(--font-display)", fontSize: "var(--hero-h1)", fontWeight: 700, lineHeight: 0.92,
              color: "var(--text-primary)", letterSpacing: -1, marginBottom: 18,
            }}
          >
            Sushi<br />Syndicate
          </h1>
          <p
            style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 24,
              color: "var(--text-secondary)", marginBottom: 36, fontWeight: 400,
            }}
          >
            {TEXTS.tagline}
          </p>
          <p style={{ fontSize: 16, fontWeight: 400, color: "var(--text-primary)", maxWidth: 440, lineHeight: 1.7, marginBottom: 48, opacity: 0.92 }}>
            {TEXTS.heroLead}
          </p>
          <div className="hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={onCtaOrder}>Замовити</button>
            <button className="btn-secondary" onClick={onCtaMenu}>Переглянути меню</button>
          </div>
        </div>

        {/* right — вертикальний промо-слайдер */}
        <HeroPromoSlider onOrder={onPromoOrder} />
      </div>
    </section>
  );
}
