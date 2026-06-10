"use client";

import { Icon } from "./icons";
import { CONTACTS, TEXTS } from "@/data/site";
import type { NavCategory } from "@/lib/types";

function FooterCol({ title, items }: { title: string; items: { label: string; cb?: () => void }[] }) {
  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-primary)", marginBottom: 22 }}>
        {title}
      </h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => (
          <li key={it.label}>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); it.cb?.(); }}
              style={{ fontSize: 16, fontWeight: 400, color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer({ onNavClick }: { onNavClick: (cat: NavCategory) => void }) {
  return (
    <footer style={{ background: "var(--bg-dark)", borderTop: "1px solid var(--border)", padding: "var(--py) var(--page-pad) 40px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "var(--footer-cols)", gap: "var(--footer-gap)", marginBottom: 64 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "var(--text-primary)" }}>
              Sushi<span style={{ color: "var(--accent)", margin: "0 4px" }}>·</span>Syndicate
            </div>
            <p style={{ fontSize: 15, fontWeight: 400, color: "var(--text-secondary)", lineHeight: 1.7, marginTop: 20, maxWidth: 280 }}>
              {TEXTS.footerTagline}
            </p>
          </div>

          <FooterCol
            title="Меню"
            items={[
              { label: "Роли", cb: () => onNavClick({ id: "roly", label: "Роли", filter: { category: "роли" } }) },
              { label: "Сети", cb: () => onNavClick({ id: "sety", label: "Сети", filter: { category: "сети" } }) },
              { label: "Новинки", cb: () => onNavClick({ id: "novynky", label: "Новинки", filter: { badge: "НОВЕ" } }) },
              { label: "Акції", cb: () => onNavClick({ id: "aktsii", label: "Акції", scrollTo: "hero" }) },
            ]}
          />

          <FooterCol title="Інформація" items={[{ label: "Доставка і оплата" }, { label: "Про нас" }, { label: "Контакти" }]} />

          <div>
            <h4 style={{ fontSize: 13, fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-primary)", marginBottom: 22 }}>
              Контакти
            </h4>
            <div style={{ fontSize: 17, fontWeight: 400, color: "var(--text-primary)", marginBottom: 10 }}>{CONTACTS.phone}</div>
            <div style={{ fontSize: 15, fontWeight: 400, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20 }}>
              {CONTACTS.address}<br />{CONTACTS.hours}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {([["Instagram", Icon.Instagram, CONTACTS.instagram], ["Telegram", Icon.Telegram, CONTACTS.telegram]] as const).map(([label, IconC, href]) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  style={{ width: 36, height: 36, border: "1px solid var(--border-light)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <IconC width="16" height="16" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 400, letterSpacing: 2, color: "var(--text-secondary)" }}>
            © 2025 SUSHI SYNDICATE · ТУЛЬЧИН, ВІННИЦЬКА ОБЛАСТЬ
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: "var(--text-secondary)" }}>
            {TEXTS.tagline}
          </div>
        </div>
      </div>
    </footer>
  );
}
