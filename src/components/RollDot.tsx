import { useId } from "react";

// рисинки по кільцю рису — фіксовані координати, щоб SSR і клієнт малювали однаково
const GRAINS = Array.from({ length: 34 }, (_, i) => {
  const a = i * 2.39996; // «золотий кут» — рівномірно, без видимого візерунка
  const r = 6.3 + ((i * 7) % 5) * 0.62;
  return {
    x: +(12 + r * Math.cos(a)).toFixed(2),
    y: +(12 + r * Math.sin(a)).toFixed(2),
    rot: Math.round((a * 180) / Math.PI + 90 + ((i * 37) % 60)),
    shade: i % 3,
  };
});

/** Зріз роли «Філадельфія» (вигляд зверху на розріз): лосось зверху, рис, норі,
 *  в центрі — вершковий сир і огірок. Реалістичні градієнти замість плоского мультяшного стилю. */
export default function RollDot() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id={`rice${id}`} cx="40%" cy="38%" r="70%">
          <stop offset="0" stopColor="#FFFDF6" />
          <stop offset="0.6" stopColor="#F1EADB" />
          <stop offset="1" stopColor="#CFC5B0" />
        </radialGradient>
        <linearGradient id={`salmon${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A6B" />
          <stop offset="0.45" stopColor="#F2733F" />
          <stop offset="1" stopColor="#C9471F" />
        </linearGradient>
        <radialGradient id={`cheese${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset="1" stopColor="#E8DDC2" />
        </radialGradient>
        <linearGradient id={`cuc${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B9D97A" />
          <stop offset="0.7" stopColor="#6E9E36" />
          <stop offset="1" stopColor="#2F5A1A" />
        </linearGradient>
        <radialGradient id={`gloss${id}`} cx="32%" cy="26%" r="60%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`top${id}`}>
          <rect x="0" y="0" width="24" height="10.5" />
        </clipPath>
      </defs>

      {/* рис */}
      <circle cx="12" cy="12" r="11" fill={`url(#rice${id})`} />
      {GRAINS.map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y} rx="0.95" ry="0.48" transform={`rotate(${g.rot} ${g.x} ${g.y})`}
          fill={g.shade === 0 ? "#FFFFFF" : g.shade === 1 ? "#E4DAC4" : "#F6F0E2"} opacity="0.9" />
      ))}

      {/* лосось, що накриває ролу зверху: шар із прожилками жиру */}
      <g clipPath={`url(#top${id})`}>
        <circle cx="12" cy="12" r="11.2" fill="none" stroke={`url(#salmon${id})`} strokeWidth="2.6" />
        <circle cx="12" cy="12" r="11.2" fill="none" stroke="#FFE1CC" strokeWidth="0.35" strokeDasharray="0.5 2.2" opacity="0.8" />
      </g>

      {/* норі */}
      <circle cx="12" cy="12" r="5.4" fill="#1E2419" stroke="#0E120B" strokeWidth="0.5" />
      {/* начинка: вершковий сир + огірок */}
      <circle cx="12" cy="12" r="4.4" fill={`url(#cheese${id})`} />
      <path d="M12.6 9.2 L15.4 10.3 L14.6 13.4 L12.1 12.7 Z" fill={`url(#cuc${id})`} />
      <path d="M12.9 10 L14.7 10.8 L14.2 12.6" fill="none" stroke="#E4F2B8" strokeWidth="0.35" opacity="0.8" />

      {/* блиск і край */}
      <circle cx="12" cy="12" r="11" fill={`url(#gloss${id})`} />
      <circle cx="12" cy="12" r="11.4" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.4" />
    </svg>
  );
}
