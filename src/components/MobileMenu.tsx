"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { CONTACTS, ASSET_ICONS } from "@/data/site";
import type { NavCategory } from "@/lib/types";

export default function MobileMenu({
  open,
  onClose,
  onNavClick,
}: {
  open: boolean;
  onClose: () => void;
  onNavClick: (cat: NavCategory) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  // Категорії доступні у фіксованій нижній панелі — у бургері лише перехід до меню
  const handle = (c: NavCategory) => { onClose(); onNavClick(c); };

  return (
    <>
      <div
        className="fade-in"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 970 }}
      />
      <aside
        className="slide-in-left"
        style={{
          position: "fixed", left: 0, top: 0, bottom: 0, width: "90vw", maxWidth: 460,
          background: "var(--bg-primary)", borderRight: "1px solid var(--border)",
          boxShadow: "8px 0 40px rgba(0,0,0,0.5)", zIndex: 971,
          display: "flex", flexDirection: "column",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: "var(--header-h)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSET_ICONS.logo} alt="" style={{ height: 40 }} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 4, color: "var(--text-primary)" }}>SUSHI</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити меню"
            style={{ width: 44, height: 44, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <Icon.Close width="18" height="18" />
          </button>
        </div>

        {/* nav + contacts */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 20px 28px", display: "flex", flexDirection: "column" }}>
          <a
            href="#menu"
            onClick={(e) => { e.preventDefault(); handle({ id: "menu", label: "Меню", scrollTo: "menu" }); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 4px", borderBottom: "1px solid var(--border)", textDecoration: "none",
              fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--text-primary)",
            }}
          >
            Меню
            <Icon.Arrow width="18" height="18" style={{ color: "var(--text-secondary)" }} />
          </a>

          {[
            { href: "/about", label: "Про нас" },
            { href: "/oferta", label: "Публічна оферта" },
          ].map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 4px", borderBottom: "1px solid var(--border)", textDecoration: "none",
                fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--text-primary)",
              }}
            >
              {it.label}
              <Icon.Arrow width="18" height="18" style={{ color: "var(--text-secondary)" }} />
            </Link>
          ))}

          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <a href={`tel:${CONTACTS.phone.replace(/[^+\d]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text-primary)" }}>
              <Icon.Phone width="16" height="16" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 15 }}>{CONTACTS.phone}</span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
              <Icon.Clock width="14" height="14" style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontSize: 13 }}>Щодня {CONTACTS.hours}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
              <Icon.Pin width="14" height="14" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13 }}>{CONTACTS.address}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {([["Instagram", ASSET_ICONS.instagram, CONTACTS.instagram], ["Telegram", ASSET_ICONS.telegram, CONTACTS.telegram]] as const).map(([label, src, href]) => (
                <a key={label} href={href} aria-label={label} style={{ width: 38, height: 38, border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={label} style={{ width: 18, height: 18 }} />
                </a>
              ))}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
