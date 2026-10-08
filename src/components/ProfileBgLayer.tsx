"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { bgUrl, type BgFrame, type ProfileBg } from "@/lib/profileBg";

function Img({ url, f, className }: { url: string; f: BgFrame; className?: string }) {
  return (
    <span className={className} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" decoding="async" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        objectPosition: `${f.posX}% ${f.posY}%`,
        filter: f.blur ? `blur(${f.blur}px)` : undefined,
        // blur дає світлі «ореоли» по краях — трохи збільшуємо; плюс наближення з налаштувань
        transform: `scale(${f.zoom / 100 + (f.blur ? Math.min(f.blur, 30) / 100 + 0.02 : 0)})`,
        transformOrigin: `${f.posX}% ${f.posY}%`,
      }} />
      <span style={{ position: "absolute", inset: 0, background: `rgba(13,11,9,${f.dim / 100})` }} />
    </span>
  );
}

/** Фон кабінету. page — на весь екран під вмістом (телефон/ПК — свій кадр за брейкпоінтом сайту);
 *  preview — у рамці редактора з конкретним кадром. */
export default function ProfileBgLayer({ bg, preview }: { bg: ProfileBg | null; preview?: "mobile" | "desktop" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const url = bg ? bgUrl(bg.src) : null;
  if (!bg || !url) return null;

  if (preview) return <Img url={url} f={bg[preview]} />;
  if (!mounted) return null;
  return createPortal(
    <div aria-hidden className="profile-bg fade-in">
      <Img url={url} f={bg.mobile} className="mobile-only" />
      <Img url={url} f={bg.desktop} className="desktop-only" />
      {/* низ плавно в колір сторінки — щоб довгі списки не «обривались» на картинці */}
      <span className="profile-bg-fade" />
    </div>,
    document.body,
  );
}
