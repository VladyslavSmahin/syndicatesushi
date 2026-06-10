"use client";

import { Icon, PhotoSlot } from "./icons";
import type { Product } from "@/lib/types";

export default function MenuCard({
  item,
  onAdd,
  onClick,
  compact = false,
}: {
  item: Product;
  onAdd: (item: Product) => void;
  onClick: () => void;
  /** компактний варіант (для блоку «Хіти меню») */
  compact?: boolean;
}) {
  const photoH = compact ? 124 : 160;
  const pad = compact ? 10 : 14;
  const titleSize = compact ? 15 : 18;
  const priceSize = compact ? 16 : 18;
  const addSize = compact ? 30 : 34;

  return (
    <div
      className="menu-card"
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        cursor: "pointer", display: "flex", flexDirection: "column", padding: pad,
      }}
    >
      <div style={{ position: "relative", background: "var(--bg-dark)" }}>
        <PhotoSlot h={photoH} photo={item.photo} />
        {item.badge && (
          <div
            style={{
              position: "absolute", top: 8, left: 8, padding: "3px 8px",
              background: item.badge === "НОВЕ" ? "var(--badge-new)" : "rgba(26,23,20,0.85)",
              border: item.badge === "НОВЕ" ? "none" : "1px solid var(--border-light)",
              color: item.badge === "НОВЕ" ? "#1A1208" : "var(--text-primary)",
              fontSize: 9, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase",
              backdropFilter: "blur(6px)",
            }}
          >
            {item.badge}
          </div>
        )}
      </div>

      <div style={{ paddingTop: compact ? 10 : 14, paddingBottom: 4, flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: titleSize, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.15, marginBottom: compact ? 4 : 6 }}>
          {item.name}
        </h3>
        {!compact && (
          <p style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14, flex: 1, letterSpacing: 0.2 }}>
            {item.desc}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: priceSize, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {item.price} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)" }}>грн</span>
          </div>
          <div style={{ fontSize: compact ? 10 : 11, fontWeight: 400, color: "var(--text-secondary)", letterSpacing: 0.8, marginTop: 4, whiteSpace: "nowrap" }}>
            {item.weight}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(item); }}
          aria-label="Додати"
          style={{
            width: addSize, height: addSize, flexShrink: 0, background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
            color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#0A0908"; e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
        >
          <Icon.Plus width="13" height="13" />
        </button>
      </div>
    </div>
  );
}
