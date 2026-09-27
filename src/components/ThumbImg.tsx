"use client";

import { useEffect, useRef } from "react";
import { thumbUrl } from "@/lib/thumb";

/**
 * <img> зі зменшеною копією фото товару і переходом на оригінал, якщо копії немає.
 * Помилка завантаження може статися ще до гідрації (img із серверного HTML) — тоді onError
 * React не побачить, тому додатково перевіряємо стан картинки при монтуванні.
 */
export default function ThumbImg({
  src,
  sizes,
  ...rest
}: {
  src: string;
  /** ширина картинки на сторінці (як у <img sizes>). Якщо задано — даємо браузеру вибір
      копія/оригінал через srcset: телефон бере легку копію, ретина-десктоп — оригінал */
  sizes?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes">) {
  const ref = useRef<HTMLImageElement>(null);

  const fallback = () => {
    const img = ref.current;
    if (!img || img.dataset.fallback) return;
    img.dataset.fallback = "1";
    img.removeAttribute("srcset"); // інакше браузер знову вибере копію з srcset
    img.src = src;
  };

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  const thumb = thumbUrl(src);
  // оригінали товарів — до 1280px (див. /api/upload), копія — 480px
  const srcSet = sizes && thumb !== src ? `${thumb} 480w, ${src} 1280w` : undefined;
  return <img ref={ref} src={thumb} srcSet={srcSet} sizes={srcSet ? sizes : undefined} onError={fallback} {...rest} />;
}
