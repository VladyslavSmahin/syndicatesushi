import BackButton from "./BackButton";
import BrandMark from "./BrandMark";

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BackButton />
          <BrandMark href="/" />
          </div>
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
