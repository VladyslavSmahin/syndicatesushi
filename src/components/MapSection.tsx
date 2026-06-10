"use client";

import { Icon } from "./icons";
import { CONTACTS } from "@/data/site";

function ContactRow({
  icon,
  label,
  value,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
}) {
  const inner = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6, fontSize: 9 }}>{label}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
  return link ? <a href={link} style={{ textDecoration: "none" }}>{inner}</a> : inner;
}

export default function MapSection() {
  return (
    <section id="map" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--head-mb)" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Де нас знайти</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
            Наше розташування
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "var(--map-cols)", gap: 1, background: "var(--border)", border: "1px solid var(--border)" }}>
          <iframe
            title="Google Maps — Sushi Syndicate"
            src={`https://www.google.com/maps?q=${encodeURIComponent(CONTACTS.mapQuery)}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: "100%", minHeight: 380, height: "100%", border: 0, display: "block", filter: "grayscale(0.2) contrast(1.05)" }}
          />

          <div style={{ background: "var(--bg-card)", padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 }}>
            <ContactRow icon={<Icon.Pin width="20" height="20" />} label="Адреса" value={CONTACTS.address} />
            <ContactRow icon={<Icon.Clock width="20" height="20" />} label="Час роботи" value={`Щодня з ${CONTACTS.hours}`} />
            <ContactRow icon={<Icon.Phone width="20" height="20" />} label="Телефон" value={CONTACTS.phone} link={`tel:${CONTACTS.phone.replace(/[^+\d]/g, "")}`} />
          </div>
        </div>
      </div>
    </section>
  );
}
