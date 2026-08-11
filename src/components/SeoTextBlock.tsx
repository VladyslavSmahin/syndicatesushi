"use client";

import { useState } from "react";
import { useSeoBlock } from "@/features/publicData";

/**
 * Текстовий блок унизу головної: опис послуги + питання-відповіді.
 * Контент редагується в адмінці; розмітка FAQPage додається на сервері (StructuredData).
 */
export default function SeoTextBlock() {
  const block = useSeoBlock();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!block.enabled) return null;

  const paragraphs = block.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <section
      style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <h2
          className="section-title"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 24 }}
        >
          {block.title}
        </h2>

        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.8, color: "var(--text-secondary)", marginBottom: 16 }}>
            {p}
          </p>
        ))}

        {block.faq.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Часті запитання</div>
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {block.faq.map((item, i) => {
                const open = openIdx === i;
                return (
                  <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      aria-expanded={open}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                        padding: "18px 0", color: "var(--text-primary)", fontFamily: "var(--font-body)",
                        fontSize: 15, fontWeight: 400, lineHeight: 1.4,
                      }}
                    >
                      {item.q}
                      <span aria-hidden style={{ flexShrink: 0, color: "var(--accent)", fontSize: 20, lineHeight: 1, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                    </button>
                    {open && (
                      <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: "var(--text-secondary)", padding: "0 0 18px" }}>
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
