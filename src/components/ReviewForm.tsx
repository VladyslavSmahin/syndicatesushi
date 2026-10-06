"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { TEXTS } from "@/data/site";
import { useScrollLock } from "@/lib/scrollLock";

// ліміти довжини — ті самі, що перевіряє /api/review
const MAX_NAME = 100;
const MAX_CONTACT = 100;
const MAX_TEXT = 2000;

/** Модалка «Залишити відгук». 5★ публікуються одразу (див. /api/review), решта — після модерації. */
export default function ReviewFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<null | "published" | "moderation">(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // після закриття — чиста форма наступного разу
  useEffect(() => {
    if (open) return;
    setName(""); setContact(""); setText(""); setRating(0); setSent(null); setError("");
  }, [open]);

  if (!open) return null;

  // порожні після trim поля не вважаємо заповненими (пробіли сервер однаково відхилить)
  const canSubmit = !!name.trim() && !!contact.trim() && !!text.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    let published = false;
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), rating, text: text.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; published?: boolean };
      if (!res.ok) {
        setError(
          res.status === 429 ? "Забагато спроб поспіль. Зачекайте хвилину й спробуйте ще раз."
          : j.error === "field_too_long" ? "Задовгий текст: імʼя та контакт — до 100 символів, відгук — до 2000."
          : j.error === "missing_fields" ? "Заповніть імʼя, контакт і текст відгуку."
          : "Не вдалося надіслати відгук. Спробуйте ще раз пізніше."
        );
        return;
      }
      published = !!j.published;
    } catch {
      setError("Не вдалося надіслати відгук. Перевірте зʼєднання й спробуйте ще раз.");
      return;
    } finally {
      setSubmitting(false);
    }
    setSent(published ? "published" : "moderation");
    if (published) router.refresh(); // підтягнути свіжий список у слайдер
  };

  return (
    <div
      onClick={onClose}
      className="fade-in"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Залишити відгук"
        className="modal-pop"
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-light)", position: "relative",
          width: 560, maxWidth: "100%", maxHeight: "calc(100dvh - 32px)", overflow: "auto", overscrollBehavior: "contain",
          padding: "var(--review-modal-pad, 32px)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрити"
          style={{
            position: "absolute", top: 14, right: 14, width: 36, height: 36, background: "rgba(13,11,9,0.6)",
            border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon.Close width="14" height="14" />
        </button>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Ваша думка важлива</div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: "var(--text-primary)", marginBottom: 20, paddingRight: 40 }}>
          Залишити відгук
        </h3>

        {sent ? (
          <div style={{ padding: "40px 24px", border: "1px solid var(--accent)", background: "var(--bg-elevated)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--accent)", marginBottom: 12 }}>
              Дякуємо!
            </div>
            <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 20 }}>
              {sent === "published" ? "Ваш відгук уже на сайті." : TEXTS.reviewThanks}
            </p>
            <button type="button" className="btn-secondary" onClick={onClose}>Закрити</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "var(--form-2col)", gap: 12, marginBottom: 12 }}>
              <input className="form-input" placeholder="Ім'я" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
              <input className="form-input" placeholder="Телефон або email" value={contact} maxLength={MAX_CONTACT} onChange={(e) => setContact(e.target.value)} />
            </div>

            <div style={{ marginBottom: 12, padding: "14px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>Оцінка:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className="star"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{ color: n <= (hoverRating || rating) ? "var(--gold)" : "var(--border-light)" }}
                  >
                    <Icon.Star width="22" height="22" filled={n <= (hoverRating || rating)} />
                  </span>
                ))}
              </div>
            </div>

            <textarea className="form-input" placeholder="Ваш відгук..." value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} style={{ marginBottom: error ? 12 : 20 }} />

            {error && <p role="alert" style={{ fontSize: 12, color: "#E0726A", marginBottom: 16, lineHeight: 1.5 }}>{error}</p>}

            <button type="submit" className="btn-primary" disabled={!canSubmit || submitting}>
              {submitting ? "Надсилаємо…" : "Надіслати"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
