"use client";

import { PhotoSlot } from "./icons";
import { CONTACTS, TEXTS } from "@/data/site";

export default function Hero({
  onCtaOrder,
  onCtaMenu,
}: {
  onCtaOrder: () => void;
  onCtaMenu: () => void;
}) {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        padding: "180px var(--page-pad) 120px",
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
        <div className="fade-up">
          <div className="eyebrow" style={{ marginBottom: 28 }}>{CONTACTS.addressShort}</div>
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
          <p style={{ fontSize: 14, fontWeight: 300, color: "var(--text-primary)", maxWidth: 420, lineHeight: 1.7, marginBottom: 48, opacity: 0.8 }}>
            {TEXTS.heroLead}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={onCtaOrder}>Замовити</button>
            <button className="btn-secondary" onClick={onCtaMenu}>Переглянути меню</button>
          </div>
        </div>

        {/* right — hero photo */}
        <div style={{ position: "relative", height: "var(--hero-h)" }}>
          <div
            style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 540, height: 540, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(192,190,200,0.08) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <PhotoSlot h="var(--hero-h)" photo="/assets/dish-salmon-pair.png" />
        </div>
      </div>
    </section>
  );
}
