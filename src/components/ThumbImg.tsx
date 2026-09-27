"use client";

import { useEffect, useRef } from "react";
import { thumbUrl } from "@/lib/thumb";

/**
 * <img> зі зменшеною копією фото товару і переходом на оригінал, якщо копії немає.
 * Помилка завантаження може статися ще до гідрації (img із серверного HTML) — тоді onError
 * React не побачить, тому додатково перевіряємо стан картинки при монтуванні.
 */
export default function ThumbImg({ src, ...rest }: { src: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const ref = useRef<HTMLImageElement>(null);

  const fallback = () => {
    const img = ref.current;
    if (!img || img.dataset.fallback) return;
    img.dataset.fallback = "1";
    img.src = src;
  };

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img ref={ref} src={thumbUrl(src)} onError={fallback} {...rest} />;
}
