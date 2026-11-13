import type { Metadata } from "next";
import BrandMark from "@/components/BrandMark";
import Cat404 from "@/components/Cat404";

export const metadata: Metadata = { title: "Сторінку не знайдено — Sushi Syndicate", robots: { index: false } };

// 404: шапка з логотипом (як на інфо-сторінках) + чорний екран з піксельною анімацією
export default function NotFound() {
  return (
    <main className="nf404" style={{ height: "100svh", overflow: "hidden", background: "#000" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, height: "var(--header-h)",
          borderBottom: "1px solid var(--border)", background: "var(--glass)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "0 var(--page-pad)" }}>
          <BrandMark href="/" />
        </div>
      </header>
      <Cat404 />
    </main>
  );
}
