"use client";

import HeroPromoSlider from "./HeroPromoSlider";
import { TEXTS } from "@/data/site";
import { useContacts, useHeroBg } from "@/features/publicData";
import HeroBgLayer from "./HeroBgLayer";
import SearchBox from "./SearchBox";
import type { Product } from "@/lib/types";
import { Icon } from "./icons";
import { useEffect, useState } from "react";
import { kyivNow, parseHours } from "@/lib/kyivTime";

export default function Hero({
  onCtaOrder,
  onCtaMenu,
  onProductOpen,
}: {
  onCtaOrder: () => void;
  onCtaMenu: () => void;
  /** відкрити товар із пошуку (поле вгорі Hero); list — усі збіги для свайпу */
  onProductOpen: (item: Product, list: Product[]) => void;
}) {
  const contacts = useContacts();
  const heroBg = useHeroBg();
  const photos = heroBg.photos.filter((p) => p.active);
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
      {/* фонові фото з адмінки (якщо є) — поверх базового градієнта; без фото все як було */}
      <HeroBgLayer photos={photos} intervalMin={heroBg.intervalMin} />
      {!photos.length && <div
        style={{
          position: "absolute", top: "-20%", right: "-10%", width: "70%", height: "120%",
          background: "radial-gradient(ellipse at top right, rgba(180,120,70,0.45) 0%, rgba(120,70,40,0.18) 30%, transparent 60%)",
          pointerEvents: "none",
        }}
      />}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 0%, rgba(13,11,9,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* пошук — одразу під шапкою, справа (на мобільному — над ейбрауном, на десктопі — поверх верхнього відступу) */}
      <div className="hero-search">
        <div className="hero-search-inner">
          <SearchBox onOpen={onProductOpen} />
        </div>
      </div>
      <div
        className="hero-grid"
        style={{
          maxWidth: 1440, margin: "0 auto", display: "grid",
          gridTemplateColumns: "var(--hero-cols)", gap: 80, alignItems: "center", position: "relative",
        }}
      >
        {/* left */}
        <div className="fade-up hero-copy">
          <div className="eyebrow hero-eyebrow" style={{ marginBottom: 28, fontSize: 15, letterSpacing: 4 }}>{contacts.addressShort}</div>
          <h1
            className="hero-title"
            style={{
              fontFamily: "var(--font-display)", fontSize: "var(--hero-h1)", fontWeight: 700, lineHeight: 0.92,
              color: "var(--text-primary)", letterSpacing: -1, marginBottom: 18,
            }}
          >
            Sushi<br className="hero-br" /> Syndicate
          </h1>
          <p
            className="hero-tagline"
            style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 24,
              color: "var(--text-secondary)", marginBottom: 36, fontWeight: 400,
            }}
          >
            {TEXTS.tagline}
          </p>
          <p className="hero-lead" style={{ fontSize: 16, fontWeight: 400, color: "var(--text-primary)", maxWidth: 440, lineHeight: 1.7, marginBottom: 48, opacity: 0.92 }}>
            {TEXTS.heroLead}
          </p>
          <div className="hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={onCtaOrder}>Замовити</button>
            <button className="btn-secondary" onClick={onCtaMenu}>Переглянути меню</button>
          </div>
          <WorkHours hours={contacts.hours} />
          {contacts.address && (
            <a className="hero-address" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contacts.mapQuery || contacts.address)}`}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 14, color: "var(--text-primary)", textDecoration: "none" }}>
              <Icon.Pin width="16" height="16" style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ borderBottom: "1px dashed var(--border-light)" }}>{contacts.address}</span>
            </a>
          )}
        </div>

        {/* right — вертикальний промо-слайдер */}
        <div className="hero-slider">
          <HeroPromoSlider />
        </div>
      </div>
    </section>
  );
}

/** Графік роботи + «Відкрито зараз / Зачинено» за київським часом.
 *  Статус рахуємо лише на клієнті (і оновлюємо щохвилини) — інакше SSR і гідрація розійдуться. */
function WorkHours({ hours }: { hours: string }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => {
      const [from, to] = parseHours(hours);
      const m = kyivNow().minutes;
      setOpen(m >= from && m < to);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [hours]);

  if (!hours) return null;
  const opensAt = hours.match(/\d{1,2}:\d{2}/)?.[0];
  return (
    <div className="hero-hours" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 28, fontSize: 14, color: "var(--text-primary)" }}>
      <Icon.Clock width="16" height="16" style={{ color: "var(--accent)", flexShrink: 0 }} />
      <span style={{ letterSpacing: 0.5 }}>Години роботи: <b style={{ fontWeight: 600 }}>{hours}</b></span>
      {open !== null && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 999, border: `1px solid ${open ? "#5BB85B" : "var(--border-light)"}`,
          color: open ? "#5BB85B" : "var(--text-secondary)", background: "rgba(13,11,9,0.4)",
        }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: open ? "#5BB85B" : "#8A8A8A" }} />
          {open ? "Відкрито зараз" : opensAt ? `Зачинено · відкриємось о ${opensAt}` : "Зачинено"}
        </span>
      )}
    </div>
  );
}
