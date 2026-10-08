"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { useFavorites } from "@/features/favorites/FavoritesContext";

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Зірочка «в обране». variant: overlay — кружечок поверх фото (картка, модалка); inline — поруч із назвою. */
export default function FavoriteStar({ productId, name, variant = "overlay", size = 34 }: {
  productId: string;
  name: string;
  variant?: "overlay" | "inline";
  size?: number;
}) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(productId);
  const [pop, setPop] = useState(0); // ключ анімації «пульс» при додаванні

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Прибрати «${name}» з обраного` : `Додати «${name}» в обране`}
      title={on ? "В обраному" : "В обране"}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!on) setPop((n) => n + 1); toggle(productId); }}
      className={`fav-star fav-star-${variant}${on ? " on" : ""}`}
      style={{ width: size, height: size }}
    >
      <Icon.Star key={pop} filled={on} width={size * 0.55} height={size * 0.55} strokeWidth={1.4} className={pop && on ? "fav-pop" : undefined} />
      {/* іскри навсібіч при додаванні (key — щоб анімація стартувала щоразу заново) */}
      {pop > 0 && on && (
        <span key={`s${pop}`} className="fav-sparks" aria-hidden>
          {SPARKS.map((a, i) => <i key={i} style={{ "--a": `${a}deg`, "--d": `${size * (i % 2 ? 0.62 : 0.8)}px` } as React.CSSProperties} />)}
        </span>
      )}
    </button>
  );
}
