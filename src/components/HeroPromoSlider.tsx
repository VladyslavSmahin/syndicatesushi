"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePublicBanners } from "@/features/publicData";

const AUTO_MS = 5000;        // авто-перемикання кожні 5с
const AFTER_MANUAL_MS = 5000; // після ручного — пауза (≥ 3с) до авто

// Hero-слайдер банерів: просто картинки, які клієнт завантажує в адмінці.
// Без кліку/ціни — банер генерується клієнтом цілком як зображення.
export default function HeroPromoSlider() {
  const banners = usePublicBanners();
  const [current, setCurrent] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const len = banners.length;

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    if (!len) return;
    timer.current = setTimeout(() => {
      setCurrent((c) => (c + 1) % len);
      schedule(AUTO_MS);
    }, delay);
  }, [len]);

  useEffect(() => {
    schedule(AUTO_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [schedule]);

  const goTo = (i: number) => {
    if (i === current) return;
    setCurrent(i);
    schedule(AFTER_MANUAL_MS); // після ручного — мінімум 3с (тут 5с) до авто
  };

  // зміщення слайда відносно центру з урахуванням «закільцьовування»
  const offsetOf = (i: number) => {
    let o = i - current;
    if (o > len / 2) o -= len;
    if (o < -len / 2) o += len;
    return o;
  };

  if (!len) return null; // немає активних банерів — слайдер не показуємо

  const styleFor = (o: number): CSSProperties => {
    const base: CSSProperties = {
      gridArea: "1 / 1",
      width: "100%",
      aspectRatio: "16 / 9",
      transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.6s, filter 0.6s",
      willChange: "transform, opacity",
    };
    if (o === 0) {
      return { ...base, transform: "translateY(0) translateZ(0) scale(1)", opacity: 1, filter: "brightness(1)", zIndex: 30 };
    }
    if (Math.abs(o) === 1) {
      return {
        ...base,
        transform: `translateY(${o * 52}%) translateZ(-170px) scale(0.8)`,
        opacity: 0.85, filter: "brightness(0.4)", zIndex: 20,
      };
    }
    // далі за межами — ховаємо
    return { ...base, transform: `translateY(${o > 0 ? 90 : -90}%) translateZ(-340px) scale(0.65)`, opacity: 0, zIndex: 10 };
  };

  return (
    <div
      style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3",
        display: "grid", placeItems: "center", perspective: 1200, overflow: "hidden",
        // мʼяке затемнення зверху/знизу, щоб сусідні слайди «йшли в темряву»
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)",
        maskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)",
      }}
    >
      {banners.map((b, i) => (
        <div
          key={b.id}
          style={{
            ...styleFor(offsetOf(i)),
            border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "#0A0908",
            boxShadow: offsetOf(i) === 0 ? "0 16px 50px rgba(0,0,0,0.55)" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      ))}

      {/* індикатори — вертикально, збоку справа */}
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 40 }}>
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Банер ${i + 1}`}
            style={{
              width: 8, height: i === current ? 22 : 8, borderRadius: 4, padding: 0, cursor: "pointer",
              border: "none", background: i === current ? "var(--accent)" : "rgba(255,255,255,0.45)", transition: "all 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
