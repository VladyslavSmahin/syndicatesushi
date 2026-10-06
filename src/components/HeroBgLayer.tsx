"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroPhoto } from "@/lib/heroBg";

/**
 * Фонові фото hero: розмиття, яскравість і затемнення — з налаштувань кожного фото.
 * Кілька фото — плавна зміна раз на `intervalMin` хв. Індекс рахується від годинника
 * (floor(now / інтервал) % кількість): усі відвідувачі бачать те саме фото, а новий — одразу поточне.
 * У DOM лише поточне й попереднє фото (для переходу), наступне — підвантажується заздалегідь.
 * Той самий компонент — у превʼю адмінки, тож там видно рівно те, що буде на сайті.
 */
export default function HeroBgLayer({ photos, intervalMin = 5 }: { photos: HeroPhoto[]; intervalMin?: number }) {
  const n = photos.length;
  const ms = Math.max(1, intervalMin) * 60_000;
  // -1 до монтування: індекс залежить від часу, а сервер і браузер його не поділяють (hydration)
  const [cur, setCur] = useState(-1);
  const [prev, setPrev] = useState(-1);
  const curRef = useRef(-1);

  useEffect(() => {
    if (!n) return;
    const slotIdx = () => Math.floor(Date.now() / ms) % n;
    const go = (i: number) => { setPrev(curRef.current); curRef.current = i; setCur(i); };
    go(slotIdx());
    if (n < 2) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        go(slotIdx());
        schedule();
      }, ms - (Date.now() % ms) + 50); // рівно на межі інтервалу
    };
    schedule();
    return () => clearTimeout(t);
  }, [n, ms]);

  // наступне фото — у кеш браузера заздалегідь, щоб перехід був без «порожнього» кадру
  useEffect(() => {
    if (n < 2 || cur < 0) return;
    const img = new Image();
    img.src = photos[(cur + 1) % n].url;
  }, [cur, n, photos]);

  if (!n) return null;
  const shown = [prev, cur].filter((i, k, a) => i >= 0 && i < n && a.indexOf(i) === k);

  return (
    // zIndex: 0 — власний контекст накладання: z-index шарів усередині не піднімає фон над вмістом hero
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {shown.map((i) => {
        const p = photos[i];
        return (
          <div
            key={p.url}
            className={i === cur ? "hero-bg-in" : undefined}
            style={{ position: "absolute", inset: 0, opacity: i === cur ? 1 : 0, transition: "opacity 1.6s ease", zIndex: i === cur ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt=""
              decoding="async"
              fetchPriority="high"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                objectPosition: `${p.posX}% ${p.posY}%`,
                filter: `blur(${p.blur}px) brightness(${p.brightness}%)`,
                // збільшення ховає світлі «ореоли» по краях, які дає blur
                transform: p.blur ? `scale(${1 + Math.min(p.blur, 30) / 100 + 0.02})` : undefined,
              }}
            />
            <div style={{ position: "absolute", inset: 0, background: `rgba(13,11,9,${p.dim / 100})` }} />
          </div>
        );
      })}
      {/* плавний перехід у фон сторінки знизу */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "linear-gradient(180deg, transparent 55%, #0D0B09 100%)" }} />
    </div>
  );
}
