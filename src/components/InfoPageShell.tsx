import Link from "next/link";
import { ASSET_ICONS } from "@/data/site";

/** Простий каркас для інфо-сторінок (оферта, про нас тощо) у стилі сайту. */
export default function InfoPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, height: "var(--header-h)",
          borderBottom: "1px solid var(--border)", background: "rgba(13,11,9,0.92)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "0 var(--page-pad)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSET_ICONS.logo} alt="Sushi Syndicate" style={{ height: 40 }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 4, color: "var(--text-primary)" }}>SUSHI</span>
          </Link>
          <Link href="/" style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>
            ← На головну
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px var(--page-pad) 80px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1.1, marginBottom: 28 }}>
          {title}
        </h1>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)", opacity: 0.92 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
