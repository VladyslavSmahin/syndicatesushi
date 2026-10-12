"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePublicBanners } from "@/features/publicData";

const AUTO_MS = 5000;  // авто-перемикання кожні 5с
const SWIPE_PX = 40;   // з якого зсуву свайп перемикає банер

// Hero-слайдер банерів: картинки, які клієнт завантажує в адмінці (без кліку/ціни).
// Телефон: банер на всю ширину, сусідні — за краєм. ПК: поточний по центру, попередній і наступний
// виглядають напівпрозорими з боків (клік по них — перейти). Свайп / перетягування, стрілки й точки під банером,
// авто-перемикання (пауза, поки курсор над банером, палець на ньому або вкладка прихована).
export default function HeroPromoSlider() {
  const banners = usePublicBanners();
  const len = banners.length;
  const [current, setCurrent] = useState(0);
  const [dx, setDx] = useState(0);          // зсув під пальцем/мишею, px
  const [paused, setPaused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);

  const go = useCallback((i: number) => setCurrent(((i % len) + len) % len), [len]);

  // авто: перезапускається після кожного перемикання (у т.ч. ручного) — повна пауза 5с
  useEffect(() => {
    if (len < 2 || paused) return;
    const t = setTimeout(() => { if (!document.hidden) go(current + 1); }, AUTO_MS);
    return () => clearTimeout(t);
  }, [current, len, paused, go]);

  // зміщення слайда відносно поточного з урахуванням «закільцьовування»: −1 — попередній, 1 — наступний
  const offsetOf = (i: number) => {
    let o = i - current;
    if (o > len / 2) o -= len;
    if (o < -len / 2) o += len;
    return o;
  };
  // попередні зміщення — щоб знати, які слайди були приховані (див. jump)
  const prevOffsets = useRef<number[]>([]);
  useEffect(() => { prevOffsets.current = banners.map((_, i) => offsetOf(i)); });

  if (!len) return null; // немає активних банерів — слайдер не показуємо

  const onDown = (e: React.PointerEvent) => {
    if (len < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    // перший помітний рух вирішує: гортаємо банер чи сторінку
    if (d.horizontal === null && Math.hypot(mx, my) > 8) {
      d.horizontal = Math.abs(mx) > Math.abs(my);
      if (d.horizontal) boxRef.current?.setPointerCapture(e.pointerId);
    }
    if (d.horizontal) setDx(mx);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.horizontal && Math.abs(dx) > SWIPE_PX) go(current + (dx < 0 ? 1 : -1));
    setDx(0);
  };

  return (
    <div className="hps-wrap">
    <div
      ref={boxRef}
      className={`hps${len > 1 ? " multi" : ""}${dx ? " dragging" : ""}`}
      style={{ "--dx": `${dx}px` } as CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") go(current - 1); if (e.key === "ArrowRight") go(current + 1); }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Акції та новини"
    >
      {banners.map((b, i) => {
        const o = offsetOf(i);
        // слайд, що був далеко (прихований), «перестрибує» на нове місце без анімації — не пролітає через видимі
        const jump = Math.abs(prevOffsets.current[i] ?? o) >= 2;
        return (
          <div key={b.id} className="hps-slide" data-pos={o === 0 ? "center" : Math.abs(o) === 1 ? "side" : "far"}
            aria-hidden={o !== 0}
            style={{ "--o": o, transition: dx || jump ? "none" : undefined } as CSSProperties}
            onClick={() => { if (Math.abs(o) === 1) go(i); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt="" draggable={false} loading={i === 0 ? "eager" : "lazy"} />
          </div>
        );
      })}
    </div>

      {/* стрілки й точки — під банером, щоб не закривати текст і ціну на картинці */}
      {len > 1 && (
        <div className="hps-nav">
          <button type="button" className="hps-arrow" aria-label="Попередній банер" onClick={() => go(current - 1)}>‹</button>
          <div className="hps-dots">
            {banners.map((b, i) => (
              <button key={b.id} type="button" className={`hps-dot${i === current ? " on" : ""}`}
                aria-label={`Банер ${i + 1}`} aria-current={i === current} onClick={() => go(i)}>
                {/* активна точка заповнюється за час до наступного банера */}
                {i === current && !paused && <span key={current} style={{ animationDuration: `${AUTO_MS}ms` }} />}
              </button>
            ))}
          </div>
          <button type="button" className="hps-arrow" aria-label="Наступний банер" onClick={() => go(current + 1)}>›</button>
        </div>
      )}
    </div>
  );
}
