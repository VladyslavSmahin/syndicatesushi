"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, PhotoSlot } from "./icons";
import type { Product } from "@/lib/types";
import { useScrollLock } from "@/lib/scrollLock";

// мінімальний горизонтальний зсув пальця (px), щоб свайп перегорнув товар
const SWIPE_MIN = 50;
// на скільки потягнути картку вниз (px), щоб вона закрилась
const CLOSE_DRAG = 110;

export default function ProductModal({
  item,
  list = [],
  onNavigate,
  onClose,
  onAdd,
}: {
  item: Product | null;
  /** список, з якого відкрили товар — свайп/стрілки гортають по ньому */
  list?: Product[];
  onNavigate?: (item: Product) => void;
  onClose: () => void;
  onAdd: (item: Product) => void;
}) {
  // напрямок останнього перегортання — для анімації в'їзду нового товару
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  // axis — напрямок жесту, визначаємо за першим помітним рухом:
  // x — гортання, y — тягнемо картку вгору/вниз (закриття), scroll — звичайний скрол вмісту.
  // Закриття вниз — лише коли вміст прокручено до верху, вгору — коли долистали до кінця.
  const touch = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | "scroll" | null; atTop: boolean; atBottom: boolean } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const idx = item ? list.findIndex((p) => p.id === item.id) : -1;
  const prevItem = idx > 0 ? list[idx - 1] : null;
  const nextItem = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  const go = (target: Product | null, d: "left" | "right") => {
    if (!target || !onNavigate) return;
    setDir(d);
    onNavigate(target);
  };

  useScrollLock(!!item);

  // скидаємо анімацію, коли модалку закрили
  useEffect(() => { if (!item) setDir(null); }, [item]);

  const setDrag = (dy: number, animate: boolean) => {
    const card = cardRef.current, bd = backdropRef.current;
    const tr = animate ? "transform 0.22s ease, background-color 0.22s ease" : "none";
    // анімація появи (fill: both) перебиває inline transform — вимикаємо її на час жесту
    if (card) { card.style.animation = "none"; card.style.transition = tr; card.style.transform = dy ? `translateY(${dy}px)` : ""; }
    // фон світлішає, поки тягнемо (opacity не годиться — картка всередині фону)
    if (bd) { bd.style.transition = tr; bd.style.backgroundColor = dy ? `rgba(0,0,0,${Math.max(0.25, 0.85 * (1 - Math.abs(dy) / 500))})` : ""; }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const c = cardRef.current;
    touch.current = {
      x: t.clientX, y: t.clientY, t: Date.now(), axis: null,
      atTop: (c?.scrollTop ?? 0) <= 0,
      atBottom: c ? c.scrollTop + c.clientHeight >= c.scrollHeight - 1 : true,
    };
  };

  // touchmove — нативний non-passive слухач: у режимі «тягнемо картку» гасимо скрол/резинку вмісту
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onMove = (e: TouchEvent) => {
      const st = touch.current;
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (!st.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        const vertical = Math.abs(dy) > Math.abs(dx);
        st.axis = vertical && ((dy > 0 && st.atTop) || (dy < 0 && st.atBottom)) ? "y"
          : vertical ? "scroll" : "x";
      }
      if (st.axis === "y") {
        e.preventDefault();
        setDrag(dy, false);
      }
    };
    card.addEventListener("touchmove", onMove, { passive: false });
    return () => card.removeEventListener("touchmove", onMove);
  }, [item?.id]);

  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current;
    touch.current = null;
    if (!st) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (st.axis === "y") {
      // закриваємо, якщо протягнули достатньо або різко змахнули (в будь-який бік)
      const dist = Math.abs(dy);
      const fast = dist > 40 && dist / Math.max(1, Date.now() - st.t) > 0.6;
      if (dist > CLOSE_DRAG || fast) {
        setDrag(Math.sign(dy) * window.innerHeight, true);
        setTimeout(onClose, 200);
      } else {
        setDrag(0, true);
      }
      return;
    }
    // гортання — лише явно горизонтальний жест, вертикальний скрол вмісту не чіпаємо
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) go(nextItem, "left");
    else go(prevItem, "right");
  };

  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(nextItem, "left");
      else if (e.key === "ArrowLeft") go(prevItem, "right");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, onClose, prevItem, nextItem]);

  if (!item) return null;

  return (
    <div
      ref={backdropRef}
      onClick={onClose}
      className="fade-in"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--modal-pad-y, 24px) var(--modal-pad-x, 88px)",
      }}
    >
      {/* стрілки по боках — для десктопа (на мобільному гортаємо свайпом) */}
      {prevItem && (
        <button className="modal-nav desktop-only" aria-label="Попередня страва" style={{ left: 24 }}
          onClick={(e) => { e.stopPropagation(); go(prevItem, "right"); }}>
          <Icon.Arrow width="18" height="18" style={{ transform: "rotate(180deg)" }} />
        </button>
      )}
      {nextItem && (
        <button className="modal-nav desktop-only" aria-label="Наступна страва" style={{ right: 24 }}
          onClick={(e) => { e.stopPropagation(); go(nextItem, "left"); }}>
          <Icon.Arrow width="18" height="18" />
        </button>
      )}
      <div
        key={item.id}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={dir === "left" ? "modal-slide-left" : dir === "right" ? "modal-slide-right" : "modal-pop"}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-light)",
          width: "var(--modal-w, 900px)", maxWidth: "100%", overflow: "auto", overscrollBehavior: "contain",
          // dvh — видима висота (на iOS vh = екран без панелей браузера, картка впиралась у краї)
          maxHeight: "calc(100dvh - 2 * var(--modal-pad-y, 24px))",
          display: "grid", gridTemplateColumns: "var(--modal-cols)", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрити"
          style={{
            position: "absolute", top: 16, right: 16, width: 36, height: 36, background: "rgba(13,11,9,0.6)",
            border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
          }}
        >
          <Icon.Close width="14" height="14" />
        </button>

        <div style={{
          position: "relative", minHeight: "var(--modal-photo-h, 320px)",
          height: "var(--modal-photo-fixed-h, auto)",
          aspectRatio: "var(--modal-photo-ar, 1 / 1)",
          overflow: "hidden",
        }}>
          <PhotoSlot h="100%" photo={item.photo} alt={`${item.name} — суші та роли, Тульчин`} eager />
          {item.badge && (
            <div
              style={{
                position: "absolute", top: 20, left: 20, padding: "6px 12px",
                background: item.badge === "НОВЕ" ? "var(--badge-new)" : "var(--accent)",
                color: "#0A0908", fontSize: 11, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase",
              }}
            >
              {item.badge === "ХІТ" ? "ХІТ ПРОДАЖІВ" : item.badge}
            </div>
          )}
        </div>

        <div style={{ padding: "var(--modal-body-pt, 22px) 32px 28px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, marginTop: 12, marginBottom: 10 }}>
            {item.name}
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>
              {item.pieces}{item.pieces && item.weight ? " · " : ""}{item.weight}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: item.oldPrice ? "var(--accent)" : "var(--text-primary)", lineHeight: 1, whiteSpace: "nowrap" }}>
              {item.oldPrice && <span style={{ fontSize: 17, fontWeight: 400, color: "var(--text-secondary)", textDecoration: "line-through", marginRight: 8 }}>{item.oldPrice}</span>}
              {item.price} <span style={{ fontSize: 15, fontWeight: 400 }}>грн</span>
            </span>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8, fontSize: 11 }}>Склад</div>
            <p style={{ fontSize: 15, fontWeight: 300, color: "var(--text-primary)", lineHeight: 1.6, opacity: 0.9 }}>
              {item.composition.toLowerCase()}
            </p>
          </div>

          {item.portion && item.portion.weight > 0 && (
            <div style={{ marginTop: 2, marginBottom: 14, fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary)" }}>
              {item.portion.kcal} ккал / {item.portion.protein} г білки / {item.portion.fat} г жири / {item.portion.carbs} г вугл.
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => { onAdd(item); onClose(); }}>
              Додати в кошик
            </button>
            <Link
              href={`/menu/${item.slug}`}
              style={{ display: "block", marginTop: 10, textAlign: "center", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Сторінка страви
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
