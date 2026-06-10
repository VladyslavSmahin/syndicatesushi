"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { CONTACTS, NAV_SPECIALS, ASSET_ICONS } from "@/data/site";
import { useCart } from "@/features/cart/CartContext";
import { useCategories } from "@/features/admin/categoriesStore";
import type { NavCategory } from "@/lib/types";

function BrandMark({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSET_ICONS.logo}
        alt="Sushi Syndicate"
        style={{ height: 48, width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
      />
      <div style={{ lineHeight: 0.95 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: 5, color: "var(--text-primary)" }}>SUSHI</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 400, letterSpacing: 4, color: "var(--text-secondary)", marginTop: 3 }}>SYNDICATE</div>
      </div>
    </a>
  );
}

function SocialLink({ href, src, label }: { href: string; src: string; label: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      style={{
        width: 34, height: 34, border: "1px solid var(--border-light)",
        display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        transition: "all 0.2s", background: "transparent",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} style={{ width: 18, height: 18, display: "block" }} />
    </a>
  );
}

export default function Header({
  onCartOpen,
  onNavClick,
}: {
  onCartOpen: () => void;
  onNavClick: (cat: NavCategory) => void;
}) {
  const { count } = useCart();
  const cats = useCategories({ navOnly: true });
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // навігація = закріплені спец-пункти + динамічні категорії
  const navItems: NavCategory[] = [
    ...NAV_SPECIALS,
    ...cats.map((c) => ({ id: c.id, label: c.name, filter: { category: c.slug } })),
  ];

  const handleNav = (cat: NavCategory) => {
    setMenuOpen(false);
    onNavClick(cat);
  };

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled || menuOpen ? "rgba(13,11,9,0.97)" : "rgba(13,11,9,0.92)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <div
        style={{
          maxWidth: 1440, margin: "0 auto", padding: "0 var(--page-pad)", height: "var(--header-h)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        {/* Brand + location */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <BrandMark onClick={() => setMenuOpen(false)} />
          <div className="desktop-only" style={{ alignItems: "center", gap: 10, paddingLeft: 24, borderLeft: "1px solid var(--border-light)", display: "flex" }}>
            <Icon.Pin width="18" height="18" style={{ color: "var(--accent)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: "var(--text-primary)", lineHeight: 1.1 }}>Тульчин</div>
              <div style={{ fontSize: 9, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", marginTop: 3 }}>Доставка та самовивіз</div>
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", justifyContent: "center" }}>
          {navItems.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="nav-link" onClick={(e) => { e.preventDefault(); handleNav(c); }}>
              {c.label.toUpperCase()}
            </a>
          ))}
        </nav>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
          <div className="desktop-only" style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              <Icon.Phone width="13" height="13" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", letterSpacing: 0.5 }}>{CONTACTS.phone}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 4, whiteSpace: "nowrap" }}>
              <Icon.Clock width="11" height="11" style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontSize: 10, fontWeight: 300, color: "var(--text-secondary)", letterSpacing: 1 }}>{CONTACTS.hours}</span>
            </div>
          </div>

          <button
            onClick={onCartOpen}
            aria-label="Кошик"
            style={{
              position: "relative", width: 44, height: 44, border: "1px solid var(--border-light)", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSET_ICONS.cart} alt="Кошик" style={{ width: 22, height: 22, filter: "invert(0.95)", display: "block" }} />
            {count > 0 && (
              <span
                style={{
                  position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 5px",
                  background: "var(--accent)", borderRadius: 9, fontSize: 9, fontWeight: 500,
                  color: "#0A0908", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {count}
              </span>
            )}
          </button>

          {/* Burger (mobile only) */}
          <button
            className="burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Меню"
            aria-expanded={menuOpen}
            style={{
              width: 44, height: 44, border: "1px solid var(--border-light)", background: menuOpen ? "var(--bg-elevated)" : "transparent",
              color: "var(--text-primary)", cursor: "pointer", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {menuOpen ? <Icon.Close width="18" height="18" /> : <Burger />}
          </button>
        </div>
      </div>

      {/* Mobile menu — drawer зліва на 90% ширини */}
      {menuOpen && (
        <>
          {/* backdrop */}
          <div
            className="fade-in"
            onClick={() => setMenuOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 199 }}
          />
          {/* drawer */}
          <aside
            className="slide-in-left"
            style={{
              position: "fixed", left: 0, top: 0, bottom: 0, width: "90vw", maxWidth: 460,
              background: "var(--bg-primary)", borderRight: "1px solid var(--border)",
              boxShadow: "8px 0 40px rgba(0,0,0,0.5)", zIndex: 200,
              display: "flex", flexDirection: "column",
            }}
          >
            {/* drawer header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: "var(--header-h)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <BrandMark onClick={() => setMenuOpen(false)} />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Закрити меню"
                style={{ width: 44, height: 44, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Icon.Close width="18" height="18" />
              </button>
            </div>

            {/* nav */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "12px 20px 24px", display: "flex", flexDirection: "column" }}>
              {navItems.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  onClick={(e) => { e.preventDefault(); handleNav(c); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "18px 4px", borderBottom: "1px solid var(--border)", textDecoration: "none",
                    fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--text-primary)",
                  }}
                >
                  {c.label}
                  <Icon.Arrow width="18" height="18" style={{ color: "var(--text-secondary)" }} />
                </a>
              ))}

              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                <a href={`tel:${CONTACTS.phone.replace(/[^+\d]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text-primary)" }}>
                  <Icon.Phone width="16" height="16" style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 15 }}>{CONTACTS.phone}</span>
                </a>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
                  <Icon.Clock width="14" height="14" style={{ color: "var(--text-secondary)" }} />
                  <span style={{ fontSize: 12, letterSpacing: 1 }}>Щодня {CONTACTS.hours}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
                  <Icon.Pin width="14" height="14" style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 12 }}>{CONTACTS.address}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <SocialLink href={CONTACTS.instagram} src={ASSET_ICONS.instagram} label="Instagram" />
                  <SocialLink href={CONTACTS.telegram} src={ASSET_ICONS.telegram} label="Telegram" />
                </div>
              </div>
            </nav>
          </aside>
        </>
      )}
    </header>
  );
}

function Burger() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
