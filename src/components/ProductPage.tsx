"use client";

import { useState } from "react";
import Link from "next/link";
import { PhotoSlot } from "./icons";
import { useCart } from "@/features/cart/CartContext";
import { usePublicCatalog, usePublicCategories, useContacts } from "@/features/publicData";
import { telHref } from "@/lib/contacts";
import { ASSET_ICONS } from "@/data/site";
import type { Product } from "@/lib/types";

/** Сторінка окремої страви: власний URL /menu/<slug> для пошуку та для того, щоб нею можна було ділитися. */
export default function ProductPage({ item }: { item: Product }) {
  const { add } = useCart();
  const contacts = useContacts();
  const catalog = usePublicCatalog();
  const cats = usePublicCategories();
  const [added, setAdded] = useState(false);

  const catName = cats.find((c) => c.slug === item.category)?.name ?? "Меню";
  const similar = catalog.filter((p) => p.category === item.category && p.id !== item.id).slice(0, 4);

  const onAdd = () => {
    add(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, height: "var(--header-h)",
          borderBottom: "1px solid var(--border)", background: "rgba(13,11,9,0.92)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: "0 var(--page-pad)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSET_ICONS.logo} alt="Sushi Syndicate" style={{ height: 40 }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 4, color: "var(--text-primary)" }}>SUSHI</span>
          </Link>
          <a href={telHref(contacts.phone)} style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: "none", letterSpacing: 0.5 }}>
            {contacts.phone}
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px var(--page-pad) 80px" }}>
        {/* хлібні крихти — і для людей, і для пошуку */}
        <nav aria-label="Навігація" style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 24 }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Головна</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <Link href="/#menu" style={{ color: "inherit", textDecoration: "none" }}>{catName}</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <span style={{ color: "var(--text-primary)" }}>{item.name}</span>
        </nav>

        <div style={{ display: "grid", gridTemplateColumns: "var(--modal-cols)", gap: 40, alignItems: "start" }}>
          <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--bg-dark)" }}>
            <PhotoSlot h="100%" photo={item.photo} alt={`${item.name} — суші та роли, Тульчин`} eager />
            {item.badge && (
              <div
                style={{
                  position: "absolute", top: 16, left: 16, padding: "6px 12px",
                  background: item.badge === "НОВЕ" ? "var(--badge-new)" : "var(--accent)",
                  color: "#0A0908", fontSize: 11, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase",
                }}
              >
                {item.badge === "ХІТ" ? "ХІТ ПРОДАЖІВ" : item.badge}
              </div>
            )}
          </div>

          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, lineHeight: 1.1, marginBottom: 14 }}>
              {item.name}
            </h1>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                {item.pieces}{item.pieces && item.weight ? " · " : ""}{item.weight}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: item.oldPrice ? "var(--accent)" : "var(--text-primary)", lineHeight: 1, whiteSpace: "nowrap" }}>
                {item.oldPrice && <span style={{ fontSize: 18, fontWeight: 400, color: "var(--text-secondary)", textDecoration: "line-through", marginRight: 8 }}>{item.oldPrice}</span>}
                {item.price} <span style={{ fontSize: 15, fontWeight: 400 }}>грн</span>
              </span>
            </div>

            {item.composition && (
              <div style={{ marginBottom: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 8, fontSize: 11 }}>Склад</div>
                <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.7, opacity: 0.9 }}>{item.composition.toLowerCase()}</p>
              </div>
            )}

            {item.fullDesc && (
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 18 }}>{item.fullDesc}</p>
            )}

            {item.portion && item.portion.weight > 0 && (
              <div style={{ marginBottom: 20, fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                На порцію: {item.portion.kcal} ккал / {item.portion.protein} г білки / {item.portion.fat} г жири / {item.portion.carbs} г вуглеводи
              </div>
            )}

            <div style={{ paddingTop: 18, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn-primary" style={{ width: "100%" }} onClick={onAdd}>
                {added ? "Додано ✓" : "Додати в кошик"}
              </button>
              {added ? (
                <Link href="/?cart=1" className="btn-secondary" style={{ width: "100%", textAlign: "center", textDecoration: "none" }}>
                  Перейти до кошика
                </Link>
              ) : (
                <Link href="/#menu" className="btn-secondary" style={{ width: "100%", textAlign: "center", textDecoration: "none" }}>
                  Все меню
                </Link>
              )}
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, marginBottom: 20 }}>
              Схожі страви
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: 20 }}>
              {similar.map((p) => (
                <Link
                  key={p.id}
                  href={`/menu/${p.slug}`}
                  style={{ textDecoration: "none", color: "inherit", background: "var(--bg-card)", border: "1px solid var(--border)", padding: 14, display: "block" }}
                >
                  <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--bg-dark)" }}>
                    <PhotoSlot h="100%" photo={p.photo} alt={`${p.name} — суші та роли, Тульчин`} />
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, marginTop: 10, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ fontSize: 15, marginTop: 6 }}>
                    {p.price} <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>грн</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
