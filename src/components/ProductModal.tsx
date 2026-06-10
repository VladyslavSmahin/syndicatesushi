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
                color: "#0A0908", fontSize: 9, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase",
              }}
            >
              {item.badge === "ХІТ" ? "ХІТ ПРОДАЖІВ" : item.badge}
            </div>
          )}
        </div>

        <div style={{ padding: "44px 40px 40px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 12 }}>
            {item.name}
          </h2>
          <div style={{ fontSize: 11, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 28 }}>
            {item.pieces} · {item.weight}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10, fontSize: 9 }}>Склад</div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--text-primary)", lineHeight: 1.7, opacity: 0.9 }}>
              {item.composition}
            </p>
          </div>

          <div style={{ marginBottom: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--text-secondary)", lineHeight: 1.7, fontStyle: "italic" }}>
              {item.fullDesc}
            </p>
          </div>

          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 24, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              {item.price} <span style={{ fontSize: 16, fontWeight: 400 }}>грн</span>
            </div>
            <button className="btn-primary" onClick={() => { onAdd(item); onClose(); }}>
              Додати в кошик
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
