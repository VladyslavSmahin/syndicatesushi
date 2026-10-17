"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SubpageHeader from "./SubpageHeader";
import MenuCard from "./MenuCard";
import { useCart } from "@/features/cart/CartContext";
import { usePublicCatalog, usePublicCategories } from "@/features/publicData";
import { CATEGORY_SEO, type CategorySeo } from "@/lib/categorySeo";

/** Сторінка категорії (/roly, /sety…): заголовок, страви категорії, текст для пошуку
 *  й посилання на інші категорії. Головну не змінює — це окремий вхід із пошуку. */
export default function CategoryPage({ slug, seo }: { slug: string; seo: CategorySeo }) {
  const router = useRouter();
  const { add, count } = useCart();
  const items = usePublicCatalog().filter((p) => p.category === slug);
  const cats = usePublicCategories({ navOnly: true });
  // інші категорії, у яких є своя сторінка — у порядку меню
  const others = cats
    .filter((c) => c.slug !== slug && CATEGORY_SEO[c.slug])
    .map((c) => ({ name: c.name, href: `/${CATEGORY_SEO[c.slug].path}` }));
  const minPrice = items.length ? Math.min(...items.map((p) => p.price)) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <SubpageHeader />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px var(--page-pad) 96px" }}>
        <nav aria-label="Навігація" style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 18 }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Головна</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <span style={{ color: "var(--text-primary)" }}>{seo.h1.split(" з доставкою")[0]}</span>
        </nav>

        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 700, lineHeight: 1.1, margin: "0 0 10px" }}>
          {seo.h1}
        </h1>
        {items.length > 0 && (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 24px" }}>
            {items.length} {plural(items.length, ["позиція", "позиції", "позицій"])} · від {minPrice} грн
          </p>
        )}

        {items.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 15, margin: "24px 0" }}>
            Зараз у цій категорії немає страв. <Link href="/#menu" style={{ color: "var(--text-primary)" }}>Усе меню</Link>
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "var(--menu-cols)", gap: "var(--menu-gap, 20px)" }}>
            {items.map((p) => (
              <MenuCard key={p.id} item={p} onAdd={add} onClick={() => router.push(`/menu/${p.slug}`)} />
            ))}
          </div>
        )}

        <section style={{ marginTop: 56, maxWidth: 760 }}>
          {seo.text.map((t, i) => (
            <p key={i} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-secondary)", margin: "0 0 14px" }}>{t}</p>
          ))}
        </section>

        {others.length > 0 && (
          <nav aria-label="Інші категорії" style={{ marginTop: 32 }}>
            <div className="eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>Інші категорії</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {others.map((o) => (
                <Link key={o.href} href={o.href} className="chip square" style={{ textDecoration: "none" }}>{o.name}</Link>
              ))}
              <Link href="/#menu" className="chip square" style={{ textDecoration: "none" }}>Усе меню</Link>
            </div>
          </nav>
        )}
      </div>

      {/* кошик живе на головній — звідси ведемо туди, щойно щось додали */}
      {count > 0 && (
        <Link
          href="/?cart=1"
          className="btn-primary"
          style={{
            position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, zIndex: 50,
            width: "min(420px, calc(100% - 32px))", textAlign: "center", textDecoration: "none",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          Перейти до кошика · {count}
        </Link>
      )}
    </main>
  );
}

function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
