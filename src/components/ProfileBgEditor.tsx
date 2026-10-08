"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import ProfileBgLayer from "./ProfileBgLayer";
import { useScrollLock } from "@/lib/scrollLock";
import { downscaleImage } from "@/lib/clientImage";
import { uploadProfileBg, saveProfileBg, suggestTheme, fetchCustomerProfile } from "@/features/account";
import {
  PROFILE_THEMES, BG_FRAME_DEFAULT, BG_SLIDERS, findThemeImage, thumbUrl,
  type BgFrame, type ProfileBg,
} from "@/lib/profileBg";

const ERR: Record<string, string> = {
  unauthorized: "Сесія завершилась — увійдіть знову.",
  too_large: "Фото завелике.",
  image_processing_failed: "Не вдалося обробити фото (спробуйте JPEG або PNG).",
  rate_limited: "Забагато спроб — зачекайте хвилину.",
  save_failed: "Не вдалося зберегти. Спробуйте пізніше.",
  bad_src: "Цю картинку не можна поставити фоном.",
  empty: "Напишіть хоч кілька слів.",
};

type Device = "mobile" | "desktop";

/** Редактор фону кабінету: тема або своє фото, кадр окремо для телефона й компʼютера, превʼю «як буде». */
export default function ProfileBgEditor({ current, name, onClose, onSaved }: {
  current: ProfileBg | null;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  useScrollLock(true);
  const custom = current && !findThemeImage(current.src) ? current.src : null;
  const [draft, setDraft] = useState<ProfileBg | null>(current);
  const [customSrc, setCustomSrc] = useState<string | null>(custom);
  const [tab, setTab] = useState<string>(current ? (PROFILE_THEMES.find((t) => t.images.some((i) => i.id === current.src))?.id ?? "custom") : "sushi");
  const [group, setGroup] = useState<string>(() => (current && findThemeImage(current.src)?.group) || "all");
  const [device, setDevice] = useState<Device>(() => (typeof window !== "undefined" && window.innerWidth > 860 ? "desktop" : "mobile"));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [idea, setIdea] = useState<string | null>(null); // null — форма пропозиції закрита
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (src: string) => setDraft((d) => ({ src, mobile: d?.mobile ?? BG_FRAME_DEFAULT, desktop: d?.desktop ?? BG_FRAME_DEFAULT }));
  const setFrame = (k: keyof BgFrame, v: number) => setDraft((d) => (d ? { ...d, [device]: { ...d[device], [k]: v } } : d));
  const patchFrame = useCallback((fn: (f: BgFrame) => Partial<BgFrame>) =>
    setDraft((d) => (d ? { ...d, [device]: { ...d[device], ...fn(d[device]) } } : d)), [device]);

  // Кадр — жестами прямо на превʼю: тягнути (палець/миша) — зсув; щипок / ctrl+колесо тачпада / колесо миші — наближення
  const previewRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const el = previewRef.current;
    if (!el) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current) {
        const k = dist / pinchDist.current;
        patchFrame((f) => ({ zoom: Math.round(clampN(f.zoom * k, 100, 200)) }));
      }
      pinchDist.current = dist;
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    // тягнемо фото за пальцем: вправо → видно лівішу частину (posX меншає)
    patchFrame((f) => ({
      posX: Math.round(clampN(f.posX - (dx / width) * 100 * (100 / f.zoom) * 0.8, 0, 100)),
      posY: Math.round(clampN(f.posY - (dy / height) * 100 * (100 / f.zoom) * 0.8, 0, 100)),
    }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = 0;
  };

  // колесо/тачпад — passive:false, щоб не прокручувати аркуш під час наближення
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        // щипок на тачпаді приходить як ctrl+wheel; звичайне колесо миші — теж наближення
        const step = e.ctrlKey ? e.deltaY * 0.6 : e.deltaY * 0.15;
        patchFrame((f) => ({ zoom: Math.round(clampN(f.zoom - step, 100, 200)) }));
      } else {
        const { width } = el.getBoundingClientRect();
        patchFrame((f) => ({ posX: Math.round(clampN(f.posX + (e.deltaX / width) * 100, 0, 100)) }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [patchFrame, draft !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const copyToOther = () => setDraft((d) => (d ? { ...d, [device === "mobile" ? "desktop" : "mobile"]: { ...d[device] } } : d));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { setMsg({ ok: false, text: "Це не зображення." }); return; }
    setBusy("Завантажуємо фото…"); setMsg(null);
    const code = await uploadProfileBg(await downscaleImage(file, 2400, 0.88));
    if (code) { setBusy(""); setMsg({ ok: false, text: ERR[code] ?? "Не вдалося завантажити фото." }); return; }
    // сервер уже зберіг фото фоном — беремо його адресу з профілю
    const p = await fetchCustomerProfile().catch(() => null);
    setBusy("");
    if (p?.profileBg) { setCustomSrc(p.profileBg.src); setDraft(p.profileBg); onSaved(); }
  };

  const save = async () => {
    setBusy("Зберігаємо…"); setMsg(null);
    const code = await saveProfileBg(draft);
    setBusy("");
    if (code) { setMsg({ ok: false, text: ERR[code] ?? "Не вдалося зберегти." }); return; }
    onSaved(); onClose();
  };

  const sendIdea = async () => {
    if (!idea?.trim()) return;
    setBusy("Надсилаємо…"); setMsg(null);
    const code = await suggestTheme(idea);
    setBusy("");
    if (code) { setMsg({ ok: false, text: ERR[code] ?? "Не вдалося надіслати." }); return; }
    setIdea(null);
    setMsg({ ok: true, text: "Дякуємо! Передали ідею команді 🙌" });
  };

  const theme = PROFILE_THEMES.find((t) => t.id === tab);
  const groups = [...new Set((theme?.images ?? []).map((i) => i.group).filter((g): g is string => !!g))];
  const f = draft?.[device] ?? BG_FRAME_DEFAULT;

  return createPortal(
    <div className="fade-in bge-overlay" onClick={onClose}>
      <div className="bge modal-pop" role="dialog" aria-modal="true" aria-label="Фон кабінету" onClick={(e) => e.stopPropagation()}>
        <div className="bge-head">
          <span className="bge-title">Фон кабінету</span>
          <button type="button" onClick={onClose} aria-label="Закрити" className="bge-x"><Icon.Close width="14" height="14" /></button>
        </div>

        <div className="bge-body">
          <div className="bge-tabs" role="tablist">
            {PROFILE_THEMES.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setGroup("all"); }}>{t.emoji} {t.label}</button>
            ))}
            <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>📷 Своє</button>
          </div>

          {/* підгрупи всередині теми (тайтли в «Аніме») */}
          {groups.length > 1 && (
            <div className="bge-tabs bge-sub" role="tablist">
              {["all", ...groups].map((g) => (
                <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>{g === "all" ? "Усі" : g}</button>
              ))}
            </div>
          )}

          <div className="bge-grid">
            {theme?.images.filter((i) => group === "all" || i.group === group).map((i) => (
              <button key={i.id} type="button" className={`bge-thumb${draft?.src === i.id ? " on" : ""}`} onClick={() => pick(i.id)} aria-label={`Фон: ${theme.label}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(i)} alt="" loading="lazy" />
              </button>
            ))}
            {tab === "custom" && (
              <>
                {customSrc && (
                  <button type="button" className={`bge-thumb${draft?.src === customSrc ? " on" : ""}`} onClick={() => pick(customSrc)} aria-label="Моє фото">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={customSrc} alt="" loading="lazy" />
                  </button>
                )}
                <button type="button" className="bge-thumb bge-upload" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                  {busy && busy.startsWith("Завантаж") ? "…" : <>＋<span>{customSrc ? "Інше фото" : "Завантажити"}</span></>}
                </button>
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif" onChange={onFile} style={{ display: "none" }} />
              </>
            )}
          </div>

          {draft && (
            <>
              <div className="bge-device" role="tablist">
                {([["mobile", "📱 Телефон"], ["desktop", "🖥 Компʼютер"]] as const).map(([d, l]) => (
                  <button key={d} type="button" role="tab" aria-selected={device === d} onClick={() => setDevice(d)}>{l}</button>
                ))}
              </div>

              <div className={`bge-preview ${device}`} ref={previewRef}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                onDoubleClick={() => patchFrame(() => ({ posX: 50, posY: 50, zoom: 100 }))}>
                <ProfileBgLayer bg={draft} preview={device} />
                <div className="bge-fake">
                  <span className="bge-fake-ava" />
                  <span className="bge-fake-name">{name || "Ваше імʼя"}</span>
                  <span className="bge-fake-line" /><span className="bge-fake-line short" />
                </div>
                <span className="bge-zoom">{f.zoom}%</span>
              </div>
              <p className="bge-hint">✋ Перетягніть фото, щоб обрати кадр · щипок або колесо — наближення · подвійний тап — скинути</p>

              <div className="bge-sliders">
                {BG_SLIDERS.filter((s) => s.key === "dim" || s.key === "blur").map((s) => (
                  <label key={s.key}>
                    <span>{s.label} <b>{f[s.key]}{s.unit}</b></span>
                    <input type="range" min={s.min} max={s.max} value={f[s.key]} onChange={(e) => setFrame(s.key, Number(e.target.value))} />
                  </label>
                ))}
              </div>
              <button type="button" className="bge-link" onClick={copyToOther}>
                Так само для {device === "mobile" ? "компʼютера" : "телефона"}
              </button>
            </>
          )}

          {idea === null ? (
            <button type="button" className="bge-link" onClick={() => { setIdea(""); setMsg(null); }}>💡 Запропонувати тематику</button>
          ) : (
            <div className="bge-idea">
              <textarea className="form-input" rows={2} maxLength={500} value={idea} autoFocus placeholder="Напр.: «Космос», «Самураї», «Зимова Японія»…"
                onChange={(e) => setIdea(e.target.value)} style={{ fontSize: 16, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setIdea(null)}>Скасувати</button>
                <button type="button" className="btn-primary" onClick={sendIdea} disabled={!!busy || !idea.trim()}>Надіслати</button>
              </div>
            </div>
          )}
          {msg && <p style={{ margin: 0, fontSize: 13, color: msg.ok ? "#5BB85B" : "#E0726A" }}>{msg.text}</p>}
          {draft && findThemeImage(draft.src) && (
            <p className="bge-credit">Фото: {findThemeImage(draft.src)!.credit}</p>
          )}
        </div>

        <div className="bge-foot">
          {current && <button type="button" className="btn-secondary" onClick={async () => { setDraft(null); setBusy("Зберігаємо…"); const c = await saveProfileBg(null); setBusy(""); if (!c) { onSaved(); onClose(); } else setMsg({ ok: false, text: ERR[c] ?? "Не вдалося." }); }} disabled={!!busy}>Без фону</button>}
          <button type="button" className="btn-primary" onClick={save} disabled={!!busy || !draft}>{busy && !busy.startsWith("Завантаж") ? busy : "Зберегти"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
