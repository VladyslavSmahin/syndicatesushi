"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { CONTACTS, ASSET_ICONS } from "@/data/site";
import { useCart } from "@/features/cart/CartContext";
import { usePublicCategories, usePublicNavSpecials } from "@/features/publicData";
import type { NavCategory } from "@/lib/types";

function BrandMark() {
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSET_ICONS.logo}
        alt="Sushi Syndicate"
        style={{ height: "var(--logo-h)", width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
      />
      <div style={{ lineHeight: 0.95 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: 5, color: "var(--text-primary)" }}>SUSHI</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 400, letterSpacing: 4, color: "var(--text-secondary)", marginTop: 3 }}>SYNDICATE</div>
      </div>
    </a>
  );
}

export default function Header({
  onCartOpen,
  onNavClick,
  menuOpen,
  onMenuToggle,
}: {
  onCartOpen: () => void;
  onNavClick: (cat: NavCategory) => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
}) {
  const { count } = useCart();
  const cats = usePublicCategories({ navOnly: true });
  const specials = usePublicNavSpecials();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navItems: NavCategory[] = [
    ...specials,
    ...cats.map((c) => ({ id: c.id, label: c.name, filter: { category: c.slug } })),
  ];

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(13,11,9,0.97)" : "rgba(13,11,9,0.92)",
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
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <BrandMark />
        </div>

        {/* Desktop nav */}
        <nav className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", justifyContent: "center" }}>
          {navItems.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="nav-link" onClick={(e) => { e.preventDefault(); onNavClick(c); }}>
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
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)", letterSpacing: 1 }}>{CONTACTS.hours}</span>
            </div>
          </div>

          <button
            onClick={onCartOpen}
            aria-label="Кошик"
            style={{
              position: "relative", width: 44, height: 44, border: "1px solid var(--border-light)", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0,
            }}
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

          {/* Burger (mobile only) — лише перемикає меню (рендериться на рівні сторінки) */}
          <button
            className="burger"
            onClick={onMenuToggle}
            aria-label="Меню"
            aria-expanded={menuOpen}
            style={{
              width: 44, height: 44, border: "1px solid var(--border-light)",
              background: menuOpen ? "var(--bg-elevated)" : "transparent",
              color: "var(--text-primary)", cursor: "pointer", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {menuOpen ? <Icon.Close width="18" height="18" /> : <Burger />}
          </button>
        </div>
      </div>
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
