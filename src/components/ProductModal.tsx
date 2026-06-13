"use client";

import { useEffect } from "react";
import { Icon, PhotoSlot } from "./icons";
import type { Product } from "@/lib/types";

export default function ProductModal({
  item,
  onClose,
  onAdd,
}: {
  item: Product | null;
  onClose: () => void;
  onAdd: (item: Product) => void;
}) {
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      className="fade-in"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-pop"
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-light)",
          width: 900, maxWidth: "100%", maxHeight: "90vh", overflow: "auto",
          display: "grid", gridTemplateColumns: "var(--modal-cols)", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрити"
          style={{
            position: "absolute", top: 16, right: 16, width: 36, height: 36, background: "rgba(13,11,9,0.6)",
            border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
          }}
        >
          <Icon.Close width="14" height="14" />
        </button>

        <div style={{ position: "relative", minHeight: 320 }}>
          <PhotoSlot h="100%" photo={item.photo} />
          {item.badge && (
            <div
              style={{
                position: "absolute", top: 20, left: 20, padding: "6px 12px",
                background: item.badge === "НОВЕ" ? "var(--badge-new)" : "var(--accent)",
                color: "#0A0908", fontSize: 11, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase",
              }}
            >
              {item.badge === "ХІТ" ? "ХІТ ПРОДАЖІВ" : item.badge}
            </div>
          )}
        </div>

        <div style={{ padding: "22px 32px 28px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 10 }}>
            {item.name}
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>
              {item.pieces}{item.pieces && item.weight ? " · " : ""}{item.weight}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, whiteSpace: "nowrap" }}>
              {item.price} <span style={{ fontSize: 15, fontWeight: 400 }}>грн</span>
            </span>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8, fontSize: 11 }}>Склад</div>
            <p style={{ fontSize: 15, fontWeight: 300, color: "var(--text-primary)", lineHeight: 1.6, opacity: 0.9 }}>
              {item.composition.toLowerCase()}
            </p>
          </div>

          {item.portion && item.portion.weight > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
                Харчова цінність порції ({item.portion.weight} г)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                {[
                  { l: "Ккал", v: item.portion.kcal },
                  { l: "Білки", v: `${item.portion.protein} г` },
                  { l: "Жири", v: `${item.portion.fat} г` },
                  { l: "Вугл.", v: `${item.portion.carbs} г` },
                ].map((n) => (
                  <div key={n.l} style={{ flex: "1 1 0", minWidth: 0, padding: "6px 3px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, whiteSpace: "nowrap" }}>{n.v}</div>
                    <div style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-secondary)", marginTop: 4 }}>{n.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => { onAdd(item); onClose(); }}>
              Додати в кошик
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
