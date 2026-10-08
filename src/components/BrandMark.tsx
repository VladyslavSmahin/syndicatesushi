import Link from "next/link";
import { ASSET_ICONS } from "@/data/site";

/** Логотип + «SUSHI / SYNDICATE» — однаковий у шапці сайту, службових сторінок і адмінки.
 *  onClick (без href) — напр. прокрутка нагору на головній; інакше — посилання (за замовчуванням на сайт). */
export default function BrandMark({ href = "/", onClick, title }: { href?: string; onClick?: () => void; title?: string }) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSET_ICONS.logo}
        alt="Sushi Syndicate"
        style={{ height: "var(--logo-h)", width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
      />
      <span style={{ lineHeight: 0.95, display: "block" }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: 5, color: "var(--text-primary)" }}>SUSHI</span>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 400, letterSpacing: 4, color: "var(--text-secondary)", marginTop: 3 }}>SYNDICATE</span>
      </span>
    </>
  );
  const style = { display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 } as const;

  if (onClick) {
    return (
      <a href={href} title={title} onClick={(e) => { e.preventDefault(); onClick(); }} style={style}>{inner}</a>
    );
  }
  return <Link href={href} title={title} style={style}>{inner}</Link>;
}
