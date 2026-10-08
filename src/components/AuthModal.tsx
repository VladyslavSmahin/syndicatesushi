"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import AuthForm, { type AuthErrorCode } from "./AuthForm";
import { useScrollLock } from "@/lib/scrollLock";

/** Вхід / реєстрація поверх сайту (без переходу на окрему сторінку). */
export default function AuthModal({ open, onClose, errorCode = null }: { open: boolean; onClose: () => void; errorCode?: AuthErrorCode }) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div onClick={onClose} className="fade-in"
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div role="dialog" aria-modal="true" aria-label="Вхід до кабінету" className="modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 14,
          padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            Особистий кабінет
          </span>
          <button type="button" onClick={onClose} aria-label="Закрити"
            style={{ width: 34, height: 34, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.Close width="14" height="14" />
          </button>
        </div>
        <AuthForm onSignedIn={onClose} errorCode={errorCode} />
      </div>
    </div>,
    document.body,
  );
}
