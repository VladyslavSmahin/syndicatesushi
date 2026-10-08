"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { useScrollLock } from "@/lib/scrollLock";

/** Кадр і корекція аватарки перед завантаженням. Превʼю й результат малює одна функція render() —
 *  тож що видно в колі, те й збережеться. */

interface Adjust { bright: number; contrast: number; sat: number; warm: number }
const ADJ_DEFAULT: Adjust = { bright: 100, contrast: 100, sat: 100, warm: 0 };
const SLIDERS: { key: keyof Adjust; label: string; min: number; max: number }[] = [
  { key: "bright", label: "Яскравість", min: 50, max: 150 },
  { key: "contrast", label: "Контраст", min: 50, max: 150 },
  { key: "sat", label: "Насиченість", min: 0, max: 200 },
  { key: "warm", label: "Тон (холодніше ↔ тепліше)", min: -50, max: 50 },
];
const OUT = 640; // розмір результату (сервер ще обріже до 320×320)

interface View { zoom: number; x: number; y: number } // x,y — зсув центру фото відносно центру кадру, у частках розміру кадру

/** Малює кадр size×size: фото «cover» × zoom зі зсувом, потім корекція пікселів. */
function render(ctx: CanvasRenderingContext2D, img: HTMLImageElement | ImageBitmap, size: number, v: View, a: Adjust) {
  const base = Math.max(size / img.width, size / img.height) * v.zoom;
  const w = img.width * base, h = img.height * base;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, size / 2 - w / 2 + v.x * size, size / 2 - h / 2 + v.y * size, w, h);
  if (a.bright === 100 && a.contrast === 100 && a.sat === 100 && a.warm === 0) return;
  // корекція вручну (а не ctx.filter): однаково в усіх браузерах, і превʼю = результат
  const data = ctx.getImageData(0, 0, size, size);
  const p = data.data;
  const br = a.bright / 100, ct = a.contrast / 100, st = a.sat / 100, wm = a.warm * 0.6;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] * br, g = p[i + 1] * br, b = p[i + 2] * br;
    r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * st; g = l + (g - l) * st; b = l + (b - l) * st;
    r += wm; b -= wm;
    p[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(data, 0, 0);
}

/** Не даємо відсунути фото так, щоб у колі зʼявилась порожнеча. */
function clampView(img: { width: number; height: number }, v: View): View {
  const zoom = Math.min(4, Math.max(1, v.zoom));
  const base = Math.max(1 / img.width, 1 / img.height) * zoom; // у частках кадру
  const maxX = (img.width * base - 1) / 2, maxY = (img.height * base - 1) / 2;
  return { zoom, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) };
}

export default function AvatarEditor({ file, onCancel, onDone }: {
  file: File;
  onCancel: () => void;
  onDone: (result: File) => void;
}) {
  useScrollLock(true);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [adj, setAdj] = useState<Adjust>(ADJ_DEFAULT);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // фото з файлу
  useEffect(() => {
    // active — щоб «скасоване» завантаження (повторний запуск ефекту, StrictMode) не показало помилку
    let active = true;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { if (active) { setErr(""); setImg(im); } };
    im.onerror = () => { if (active) setErr("Цей браузер не відкриває такий формат фото. Спробуйте JPEG або PNG."); };
    im.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // превʼю (canvas у 2× для чіткості на телефоні)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const size = c.width;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (ctx) render(ctx, img, size, view, adj);
  }, [img, view, adj]);

  const move = useCallback((fn: (v: View) => View) => setView((v) => (img ? clampView(img, fn(v)) : v)), [img]);

  // жести: тягнути — зсув; щипок / колесо — наближення; подвійний тап — скинути
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const el = stageRef.current;
    if (!prev || !el) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) { const k = d / pinch.current; move((v) => ({ ...v, zoom: v.zoom * k })); }
      pinch.current = d;
      return;
    }
    const s = el.getBoundingClientRect().width;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    move((v) => ({ ...v, x: v.x + dx / s, y: v.y + dy / s }));
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = 0; };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.ctrlKey ? e.deltaY * 0.01 : e.deltaY * 0.0015;
      move((v) => ({ ...v, zoom: v.zoom - step }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [move, img]);

  const save = () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    render(ctx, img, OUT, view, adj);
    c.toBlob((blob) => {
      if (blob) onDone(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  return createPortal(
    <div className="fade-in bge-overlay" onClick={onCancel}>
      <div className="bge modal-pop" role="dialog" aria-modal="true" aria-label="Фото профілю" onClick={(e) => e.stopPropagation()}>
        <div className="bge-head">
          <span className="bge-title">Фото профілю</span>
          <button type="button" onClick={onCancel} aria-label="Закрити" className="bge-x"><Icon.Close width="14" height="14" /></button>
        </div>
        <div className="bge-body">
          {err ? <p style={{ margin: 0, color: "#E0726A", fontSize: 14 }}>{err}</p> : (
            <>
              <div className="ave-stage" ref={stageRef}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                onDoubleClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
                <canvas ref={canvasRef} width={600} height={600} />
                <span className="ave-mask" aria-hidden />
                {!img && <span className="skel" style={{ position: "absolute", inset: 0 }} />}
              </div>
              <p className="bge-hint">✋ Перетягніть фото в колі · щипок або колесо — розмір · подвійний тап — скинути</p>
              <div className="bge-sliders">
                {SLIDERS.map((s) => (
                  <label key={s.key}>
                    <span>{s.label} <b>{s.key === "warm" ? (adj.warm > 0 ? `+${adj.warm}` : adj.warm) : `${adj[s.key]}%`}</b></span>
                    <input type="range" min={s.min} max={s.max} value={adj[s.key]} onChange={(e) => setAdj((a) => ({ ...a, [s.key]: Number(e.target.value) }))} />
                  </label>
                ))}
              </div>
              <button type="button" className="bge-link" onClick={() => setAdj(ADJ_DEFAULT)}>Скинути кольори</button>
            </>
          )}
        </div>
        <div className="bge-foot">
          <button type="button" className="btn-secondary" onClick={onCancel}>Скасувати</button>
          <button type="button" className="btn-primary" onClick={save} disabled={!img}>Зберегти</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
