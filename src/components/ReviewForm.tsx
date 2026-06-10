"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { TEXTS } from "@/data/site";

export default function ReviewForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contact || !text || submitting) return;
    setSubmitting(true);
    try {
      // TODO (після Supabase): запис у таблицю reviews (status=pending).
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, rating, text }),
      });
    } catch {
      /* навіть якщо не дійшло — показуємо подяку, відгук не критичний */
    } finally {
      setSubmitting(false);
    }
    setSent(true);
    setTimeout(() => {
      setName(""); setContact(""); setText(""); setRating(0); setSent(false);
    }, 4000);
  };

  return (
    <section id="reviews" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gridTemplateColumns: "var(--reviews-cols)", gap: "var(--reviews-gap)" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Ваша думка важлива</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)", marginBottom: 24 }}>
            Відгуки та<br />пропозиції
          </h2>
          <p style={{ fontSize: 14, fontWeight: 300, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 380 }}>
            Поділіться враженнями від наших страв. Ми читаємо кожен відгук та обов&apos;язково відповідаємо.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {sent ? (
            <div style={{ padding: "56px 40px", border: "1px solid var(--accent)", background: "var(--bg-elevated)", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--accent)", marginBottom: 12 }}>
                Дякуємо!
              </div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{TEXTS.reviewThanks}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "var(--form-2col)", gap: 12, marginBottom: 12 }}>
                <input className="form-input" placeholder="Ім'я" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="form-input" placeholder="Телефон або email" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>

              <div style={{ marginBottom: 12, padding: "16px 18px", background: "var(--bg-card)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 16 }}>
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

              <textarea className="form-input" placeholder="Ваш відгук..." value={text} onChange={(e) => setText(e.target.value)} style={{ marginBottom: 20 }} />

              <button type="submit" className="btn-primary" disabled={!name || !contact || !text || submitting}>
                {submitting ? "Надсилаємо…" : "Надіслати"}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
