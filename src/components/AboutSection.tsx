"use client";

import { useGloss } from "@/features/publicData";

export default function AboutSection() {
  const title = useGloss("about_title");
  const text = useGloss("about_text");
  // абзаци розділяються порожнім рядком у тексті глосарію
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <section id="about" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <h2 className="section-title" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1.05, color: "var(--text-primary)", marginBottom: 28 }}>
          {title}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 16, fontWeight: 300, color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-line" }}>
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
