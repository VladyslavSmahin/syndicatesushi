"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { usePublicReviews, type PubReview } from "@/features/publicData";
import ReviewFormModal from "./ReviewForm";

const GAP = 20;
const INTERVAL = 3000;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // фіксований часовий пояс — інакше сервер (UTC) і браузер можуть показати різний день (hydration mismatch)
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv" });
};

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= rating ? "var(--gold)" : "var(--border-light)" }}>
          <Icon.Star width="15" height="15" filled={n <= rating} />
        </span>
      ))}
    </div>
  );
}

function Card({ r }: { r: PubReview }) {
  return (
    <div
      style={{
        flex: "0 0 calc((100% - (var(--review-cols) - 1) * 20px) / var(--review-cols))",
        background: "var(--bg-card)", border: "1px solid var(--border)", padding: 22,
        display: "flex", flexDirection: "column", gap: 12, minWidth: 0,
      }}
    >
      <Stars rating={r.rating} />
      <p style={{ fontSize: 14, fontWeight: 300, color: "var(--text-primary)", lineHeight: 1.7, flex: 1, opacity: 0.92 }}>
        {r.text}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          {r.authorName}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
          {fmtDate(r.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default function ReviewsList() {
  const reviews = usePublicReviews();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [cols, setCols] = useState(4);
  const [formOpen, setFormOpen] = useState(false);
  const [stepPx, setStepPx] = useState(0);

  // зчитуємо к-сть видимих карток (--review-cols) і крок зсуву (ширина картки + gap)
  useEffect(() => {
    const read = () => {
      const vp = viewportRef.current, track = trackRef.current;
      if (!vp) return;
      const v = parseInt(getComputedStyle(vp).getPropertyValue("--review-cols")) || 4;
      setCols(v);
      const card = track?.children[0] as HTMLElement | undefined;
      if (card) setStepPx(card.getBoundingClientRect().width + GAP);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [reviews.length]); // перший відгук міг зʼявитися вже після монтування (5★ → одразу на сайт)

  const len = reviews.length;
  const canSlide = len > cols;

  // слайдити вже нема чого (напр. поворот екрана → більше колонок) — повертаємо стрічку на початок
  useEffect(() => {
    if (!canSlide) setIndex(0);
  }, [canSlide]);

  // автопрокрутка по одній картці кожні 3 с
  useEffect(() => {
    if (!canSlide || paused) return;
    const t = setInterval(() => setIndex((i) => i + 1), INTERVAL);
    return () => clearInterval(t);
  }, [canSlide, paused]);

  // безшовний цикл: дійшли до кінця оригіналу → миттєвий скид на 0
  const handleEnd = () => {
    if (index >= len) {
      setAnimate(false);
      setIndex(0);
      // повертаємо анімацію після перерисовки
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }
  };

  // дублюємо стрічку для безшовного циклу (лише якщо реально слайдимо)
  const slides = canSlide ? [...reviews, ...reviews.slice(0, cols)] : reviews;

  return (
    <section id="reviews" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto var(--head-mb, 28px)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Ваша думка важлива</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
            Відгуки гостей
          </h2>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setFormOpen(true)}>Залишити відгук</button>
      </div>

      {!len && (
        <p style={{ maxWidth: 1440, margin: "0 auto", fontSize: 14, fontWeight: 300, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Поки що відгуків немає — поділіться враженнями першим.
        </p>
      )}

      <div
        ref={viewportRef}
        style={{ maxWidth: 1440, margin: "0 auto", overflow: "hidden", display: len ? undefined : "none" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          onTransitionEnd={handleEnd}
          style={{
            display: "flex", gap: GAP,
            transform: `translateX(-${index * stepPx}px)`,
            transition: animate ? "transform 0.6s cubic-bezier(0.4,0,0.2,1)" : "none",
          }}
        >
          {slides.map((r, i) => (
            <Card key={`${r.id}-${i}`} r={r} />
          ))}
        </div>
      </div>

      <ReviewFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </section>
  );
}
