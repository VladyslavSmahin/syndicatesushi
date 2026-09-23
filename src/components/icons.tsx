import type { SVGProps } from "react";
import { ASSET_ICONS } from "@/data/site";

type P = SVGProps<SVGSVGElement>;

export const Icon = {
  Cart: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 4h2.5l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 8H6.5" />
      <circle cx="10" cy="20.5" r="1.1" />
      <circle cx="18" cy="20.5" r="1.1" />
    </svg>
  ),
  Close: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" {...p}>
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  ),
  Arrow: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Trash: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 7h16M9 7V4h6v3M10 11v7M14 11v7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  ),
  Plus: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...p}>
      <path d="M5 12h14" />
    </svg>
  ),
  Phone: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  Star: ({ filled, ...p }: P & { filled?: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" {...p}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
    </svg>
  ),
  Pin: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s7-7.6 7-13a7 7 0 1 0-14 0c0 5.4 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  Clock: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  Instagram: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  ),
  Telegram: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" {...p}>
      <path d="M21.5 4.5L2.5 12.2l5.5 1.7 2.3 5.6 3-3.4 5.4 4 2.8-15.6z" />
      <path d="M8 13.9l8.5-6.8-6.5 8" />
    </svg>
  ),
  Facebook: (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M14.5 8.2h-1.2c-.9 0-1.5.6-1.5 1.5v1.4m-1.6 0h4.6m-3 0V18" />
    </svg>
  ),
};

export function PhotoSlot({
  h = 280,
  photo,
  alt = "",
  eager = false,
}: {
  h?: number | string;
  photo?: string | null;
  /** опис фото для пошуку та скрінрідерів; порожній = декоративне */
  alt?: string;
  /** true для фото «над згином» (модалка) — без ліниві́ї загрузки */
  eager?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: h,
        background: photo ? "#0A0908" : "linear-gradient(135deg, #1A1714 0%, #0E0C0A 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {photo && (
        // фото — саме <img>, а не background: інакше в нього немає alt і його не бачить пошук
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {!photo && <PhotoPending />}
    </div>
  );
}

/**
 * Заглушка для товарів без фото: мультяшна сушинка повідомляє, що фото в роботі.
 * Фоном — логотип (дві рибки). Розміри в cqw, тож однаково виглядає і в картці
 * меню, і на великому фото в модалці.
 */
function PhotoPending() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4cqw",
        padding: "6cqw",
        background: "radial-gradient(circle at 30% 30%, rgba(192,190,200,0.05) 0%, transparent 62%)",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* логотип сайту — водяний знак */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSET_ICONS.logo}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: "88%", opacity: 0.07, filter: "grayscale(1)", userSelect: "none",
        }}
      />

      <SushiGuy style={{ width: "clamp(56px, 36cqw, 116px)", height: "auto", position: "relative" }} />

      {/* хмаринка з текстом */}
      <div
        style={{
          position: "relative", maxWidth: "96%", textAlign: "center",
          background: "rgba(19,17,16,0.72)", border: "1px solid var(--border-light)",
          borderRadius: 10, padding: "3cqw 4cqw", backdropFilter: "blur(4px)",
        }}
      >
        <span
          style={{
            position: "absolute", left: "50%", top: -5, width: 8, height: 8,
            transform: "translateX(-50%) rotate(45deg)",
            background: "rgba(19,17,16,0.72)",
            borderLeft: "1px solid var(--border-light)", borderTop: "1px solid var(--border-light)",
          }}
        />
        <span
          style={{
            display: "block", fontFamily: "var(--font-body)", color: "var(--text-primary)",
            fontSize: "clamp(9px, 4.4cqw, 13px)", lineHeight: 1.25, letterSpacing: 0.2,
          }}
        >
          Фото вже готується
        </span>
        <span
          style={{
            display: "block", fontFamily: "var(--font-body)", color: "var(--gold)",
            fontSize: "clamp(8px, 3.6cqw, 11px)", lineHeight: 1.3, letterSpacing: 1,
            textTransform: "uppercase", marginTop: 2,
          }}
        >
          скоро буде тут
        </span>
      </div>
    </div>
  );
}

/** мультяшна нігірі-сушинка */
function SushiGuy(p: P) {
  return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" {...p}>
      {/* тінь */}
      <ellipse cx="60" cy="91" rx="39" ry="5" fill="#000" opacity="0.35" />
      {/* рис */}
      <rect x="20" y="50" width="80" height="36" rx="13" fill="#F5F0E7" />
      <ellipse cx="34" cy="78" rx="4" ry="2.4" fill="#DED7C9" opacity="0.5" />
      <ellipse cx="86" cy="80" rx="3.4" ry="2" fill="#DED7C9" opacity="0.45" />
      {/* лосось */}
      <path d="M16 40 Q60 19 104 40 L104 50 Q60 63 16 50 Z" fill="#E8845C" />
      <path d="M16 40 Q60 19 104 40 Q60 30 16 40 Z" fill="#F2A585" />
      <path d="M26 45 Q60 30 94 45" stroke="#FBDACB" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
      <path d="M31 52 Q60 39 89 52" stroke="#FBDACB" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* обличчя */}
      <ellipse cx="33" cy="73" rx="5" ry="3" fill="#E8845C" opacity="0.32" />
      <ellipse cx="87" cy="73" rx="5" ry="3" fill="#E8845C" opacity="0.32" />
      <circle cx="43" cy="66" r="3.6" fill="#2B2723" />
      <circle cx="77" cy="66" r="3.6" fill="#2B2723" />
      <circle cx="44.3" cy="64.8" r="1.2" fill="#FFF" opacity="0.9" />
      <circle cx="78.3" cy="64.8" r="1.2" fill="#FFF" opacity="0.9" />
      <path d="M53 72 q7 6.5 14 0" stroke="#2B2723" strokeWidth="2.4" strokeLinecap="round" />
      {/* «зачекайте трішки» */}
      <circle cx="101" cy="22" r="2.6" fill="#C9A84C" opacity="0.75" />
      <circle cx="109" cy="14" r="1.8" fill="#C9A84C" opacity="0.5" />
      <circle cx="114" cy="8" r="1.2" fill="#C9A84C" opacity="0.3" />
    </svg>
  );
}
