"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTikTok } from "@/features/publicData";
import { tiktokPlayerUrl, tiktokUsername, type TikTokVideo } from "@/lib/tiktok";
import { useScrollLock } from "@/lib/scrollLock";
import { Icon } from "./icons";

/** «Ми в TikTok» під відгуками: стрічка обкладинок 9:16 (наші, з R2), тап — плеєр TikTok у модалці.
 *  Плеєр (iframe) вантажимо лише по тапу — щоб головна не важчала на 6 сторонніх плеєрів. */
export default function TikTokSection() {
  const { enabled, profileUrl, mode, videos: manual, autoVideos } = useTikTok();
  const [open, setOpen] = useState<TikTokVideo | null>(null);
  const user = tiktokUsername(profileUrl);
  // auto — підтягнуті сервером ролики; поки їх нема (або TikTok не відповів) — офіційний віджет
  const videos = mode === "auto" ? autoVideos : mode === "videos" ? manual : [];
  const widget = !videos.length && mode !== "videos" && !!user;
  if (!enabled || (!widget && !videos.length)) return null;

  return (
    <section id="tiktok" style={{ padding: "var(--py) var(--page-pad)", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto var(--head-mb, 28px)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Як ми готуємо</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
            Ми в TikTok
          </h2>
        </div>
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: "none" }}>
            Дивитись усі
          </a>
        )}
      </div>

      {widget ? <CreatorWidget user={user!} profileUrl={profileUrl} /> : (
      <div className="tt-strip">
        {videos.map((v) => (
          <button key={v.id} type="button" className="tt-card" onClick={() => setOpen(v)} aria-label={`Дивитись відео: ${v.title || "TikTok"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.thumb} alt="" loading="lazy" />
            <span className="tt-play" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
            {v.plays != null && <span className="tt-plays">▶ {fmtPlays(v.plays)}</span>}
            {v.title && <span className="tt-title">{v.title}</span>}
          </button>
        ))}
      </div>
      )}

      {open && <TikTokModal video={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

const fmtPlays = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)).replace(".0", "");

/** Офіційний віджет профілю TikTok: останні ролики підтягує сам TikTok.
 *  embed.js вантажимо, лише коли блок наближається до екрана (щоб не важчала головна). */
function CreatorWidget({ user, profileUrl }: { user: string; profileUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    // embed.js при завантаженні перетворює blockquote.tiktok-embed на iframe; повторне додавання — пересканувати
    document.querySelectorAll('script[data-tiktok-embed]').forEach((s) => s.remove());
    const s = document.createElement("script");
    s.src = "https://www.tiktok.com/embed.js";
    s.async = true;
    s.dataset.tiktokEmbed = "1";
    document.body.appendChild(s);
    // коли зʼявився iframe — прибираємо силует завантаження
    const el = ref.current;
    if (!el) return;
    const mo = new MutationObserver(() => { if (el.querySelector("iframe")) { setReady(true); mo.disconnect(); } });
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [near]);

  return (
    <div className="tt-widget" ref={ref}>
      {!ready && <span className="skel tt-widget-skel" aria-hidden />}
      {near && (
        <blockquote className="tiktok-embed" cite={profileUrl} data-unique-id={user} data-embed-type="creator" style={{ maxWidth: 780, minWidth: 288, margin: 0 }}>
          <section><a target="_blank" rel="noopener noreferrer" href={`${profileUrl}?refer=creator_embed`}>@{user}</a></section>
        </blockquote>
      )}
      <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="tt-open" style={{ display: "block", textAlign: "center", marginTop: 10 }}>
        @{user} у TikTok ↗
      </a>
    </div>
  );
}

function TikTokModal({ video, onClose }: { video: TikTokVideo; onClose: () => void }) {
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fade-in tt-overlay" onClick={onClose}>
      <div className="tt-modal modal-pop" role="dialog" aria-modal="true" aria-label="Відео TikTok" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Закрити" className="tt-close"><Icon.Close width="14" height="14" /></button>
        <iframe
          src={tiktokPlayerUrl(video.id)}
          title={video.title || "Відео TikTok"}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <a href={video.url} target="_blank" rel="noopener noreferrer" className="tt-open">Відкрити в TikTok ↗</a>
      </div>
    </div>,
    document.body,
  );
}
