"use client";

import { useEffect, useRef, useState } from "react";
import { useDbHeroBg, dbSaveHeroBg, dbUploadImage, dbDeleteHeroPhotoFile } from "@/features/admin/db";
import { HERO_PHOTO_DEFAULTS, type HeroBg, type HeroPhoto } from "@/lib/heroBg";
import { downscaleImage } from "@/lib/clientImage";
import HeroBgLayer from "@/components/HeroBgLayer";
import s from "@/components/admin/admin.module.css";

const MIN_SIDE = 1600; // менше по довгій стороні — на великому екрані фото буде мильним
const MAX_UPLOAD = 4 * 1024 * 1024; // ліміт тіла запиту Vercel ~4.5 МБ

type NumKey = "blur" | "dim" | "brightness" | "posX" | "posY";
const SLIDERS: { key: NumKey; label: string; min: number; max: number; unit: string }[] = [
  { key: "blur", label: "Розмиття", min: 0, max: 30, unit: "px" },
  { key: "dim", label: "Затемнення", min: 0, max: 90, unit: "%" },
  { key: "brightness", label: "Яскравість", min: 50, max: 150, unit: "%" },
  { key: "posX", label: "Кадр ↔", min: 0, max: 100, unit: "%" },
  { key: "posY", label: "Кадр ↕", min: 0, max: 100, unit: "%" },
];

const ERR: Record<string, string> = {
  unauthorized: "Немає доступу (увійдіть як співробітник).",
  r2_not_configured: "Сховище R2 не налаштоване (ключі Cloudflare).",
  too_large: "Файл завеликий.",
  image_processing_failed: "Не вдалося обробити зображення (спробуйте JPEG або PNG).",
  upload_failed: "Помилка завантаження у сховище.",
};

async function longSide(file: File): Promise<number | null> {
  try {
    const b = await createImageBitmap(file);
    const v = Math.max(b.width, b.height);
    b.close?.();
    return v;
  } catch {
    return null; // не декодується в цьому браузері (напр. HEIC не в Safari) — перевірить сервер
  }
}

export default function HeroBgPage() {
  const { heroBg, loading, refetch } = useDbHeroBg();
  const [draft, setDraft] = useState<HeroBg | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (!loading) { setDraft(heroBg); setDirty(false); } }, [loading, heroBg]);

  const persist = async (next: HeroBg) => {
    setSaving(true);
    const err = await dbSaveHeroBg(next);
    setSaving(false);
    if (err) { alert("Помилка збереження: " + err); return false; }
    setDirty(false);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    return true;
  };

  const change = (fn: (d: HeroBg) => HeroBg) => { setDraft((d) => (d ? fn(d) : d)); setDirty(true); };
  const setPhoto = (i: number, patch: Partial<HeroPhoto>) =>
    change((d) => ({ ...d, photos: d.photos.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !draft) return;
    const msgs: string[] = [];
    const added: HeroPhoto[] = [];
    for (const [n, file] of files.entries()) {
      setBusy(`Завантаження ${n + 1} з ${files.length}…`);
      if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { msgs.push(`${file.name}: це не зображення.`); continue; }
      const side = await longSide(file);
      if (side && side < MIN_SIDE) msgs.push(`${file.name}: лише ${side}px по довгій стороні — на великому екрані буде нечітко.`);
      // у браузері — до 2560px і якісний WebP (щоб пройти ліміт запиту); фінальне стиснення робить сервер
      let prepared = await downscaleImage(file, 2560, 0.92);
      if (prepared.size > MAX_UPLOAD) prepared = await downscaleImage(file, 2560, 0.82);
      if (prepared.size > MAX_UPLOAD) { msgs.push(`${file.name}: завеликий навіть після стиснення.`); continue; }
      const { url, error } = await dbUploadImage(prepared, "hero");
      if (!url) { msgs.push(`${file.name}: ${ERR[error ?? ""] ?? error}`); continue; }
      // нове фото — вимкнене: спершу налаштувати в превʼю, потім увімкнути «Показувати на сайті»
      added.push({ url, ...HERO_PHOTO_DEFAULTS, active: false });
    }
    setBusy("");
    setNotes(msgs);
    if (added.length) {
      // одразу зберігаємо, щоб завантажені файли не «загубились» без запису в налаштуваннях
      const next = { ...draft, photos: [...draft.photos, ...added] };
      setDraft(next);
      if (await persist(next)) refetch();
    }
  };

  const move = (i: number, dir: -1 | 1) =>
    change((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.photos.length) return d;
      const photos = [...d.photos];
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { ...d, photos };
    });

  const remove = async (i: number) => {
    if (!draft || !confirm("Видалити фото з фону?")) return;
    const url = draft.photos[i].url;
    const next = { ...draft, photos: draft.photos.filter((_, k) => k !== i) };
    setDraft(next);
    if (await persist(next)) { dbDeleteHeroPhotoFile(url); refetch(); }
  };

  if (loading || !draft) return <p className={s.hint}>Завантаження…</p>;
  const activeCount = draft.photos.filter((p) => p.active).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Фонові фото головного екрана — під заголовком «Sushi Syndicate». Для кожного фото налаштуйте розмиття
        й затемнення так, щоб текст добре читався. Фото можна додавати скільки завгодно: активні по черзі
        змінюють одне одне (за замовчуванням — раз на 5 хвилин), і всі відвідувачі бачать те саме фото.
        Без фото головна виглядає як зараз.
      </p>

      <div className={s.card} style={{ borderColor: "rgba(201,168,76,0.45)" }}>
        <div className={s.cardBody} style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>
          <b>Якість фото — важливо.</b> Фото тягнеться на весь екран, тож:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--text-secondary)" }}>
            <li>знімайте <b>горизонтально</b>, основною камерою (1×), без цифрового зуму;</li>
            <li>при денному світлі або яскравому освітленні, без спалаху;</li>
            <li>протріть камеру й тримайте телефон нерухомо — змазане фото не врятує жодне налаштування;</li>
            <li>надсилайте оригінал (не скриншот і не фото з месенджера — вони стиснені).</li>
          </ul>
          <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
            Сайт сам стисне фото оптимально для великого екрана (до 2560px, WebP) — оригінал важить у кілька разів більше.
          </div>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.cardHead} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className={s.cardTitle}>Фото ({draft.photos.length})</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {saved && <span className={s.hint} style={{ color: "var(--accent)" }}>Збережено</span>}
            {dirty && (
              <button className={s.btn} onClick={async () => { if (await persist(draft)) refetch(); }} disabled={saving}>
                {saving ? "Збереження…" : "Зберегти зміни"}
              </button>
            )}
            <button className={`${s.btn} ${dirty ? s.btnGhost : ""}`} onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy || "+ Завантажити фото"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          </div>
        </div>

        <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {notes.length > 0 && (
            <div className={s.error} style={{ lineHeight: 1.5 }}>{notes.map((m) => <div key={m}>{m}</div>)}</div>
          )}

          {activeCount > 1 && (
            <div className={s.sliderRow}>
              <span className={s.sliderLabel}>Зміна фото</span>
              <input className={s.range} type="range" min={1} max={60} value={draft.intervalMin}
                onChange={(e) => change((d) => ({ ...d, intervalMin: Number(e.target.value) }))} />
              <span className={s.sliderVal}>{draft.intervalMin} хв</span>
            </div>
          )}

          {draft.photos.length === 0 && (
            <p className={s.hint}>Фото ще немає. Натисніть «Завантажити фото» — можна обрати кілька одразу.</p>
          )}
          {draft.photos.some((p) => !p.active) && (
            <p className={s.hint}>Нові фото завантажуються вимкненими: налаштуйте повзунки, увімкніть «Показувати на сайті» і натисніть «Зберегти зміни».</p>
          )}

          <div className={s.heroGrid}>
          {draft.photos.map((p, i) => (
            <div key={p.url} className={s.heroBlock}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>Фото {i + 1}</span>
                <span className={`${s.pill} ${p.active ? s.pillEditor : ""}`} style={{ fontSize: 10 }}>{p.active ? "На сайті" : "Вимкнено"}</span>
              </div>
              <div className={s.heroPreviews}>
                <Preview photo={p} ratio="16 / 7" title />
                <Preview photo={p} ratio="9 / 16" />
              </div>

              {SLIDERS.map((sl) => (
                <div key={sl.key} className={s.sliderRow}>
                  <span className={s.sliderLabel}>{sl.label}</span>
                  <input className={s.range} type="range" min={sl.min} max={sl.max} value={p[sl.key]}
                    onChange={(e) => setPhoto(i, { [sl.key]: Number(e.target.value) })} />
                  <span className={s.sliderVal}>{p[sl.key]}{sl.unit}</span>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginRight: "auto" }}>
                  <input type="checkbox" checked={p.active} onChange={(e) => setPhoto(i, { active: e.target.checked })} />
                  На сайті
                </label>
                <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Раніше в черзі">◀</button>
                <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => move(i, 1)} disabled={i === draft.photos.length - 1} aria-label="Пізніше в черзі">▶</button>
                <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => setPhoto(i, { ...HERO_PHOTO_DEFAULTS, active: p.active })}
                  title="Скинути налаштування" aria-label="Скинути налаштування">↺</button>
                <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(i)}
                  title="Видалити фото" aria-label="Видалити фото" style={{ display: "inline-flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          </div>

          {dirty && draft.photos.length > 0 && (
            <button className={s.btn} style={{ alignSelf: "flex-start" }} onClick={async () => { if (await persist(draft)) refetch(); }} disabled={saving}>
              {saving ? "Збереження…" : "Зберегти зміни"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Превʼю: той самий шар, що на сайті, + зразок заголовка — видно, чи читається текст.
function Preview({ photo, ratio, title }: { photo: HeroPhoto; ratio: string; title?: boolean }) {
  return (
    <div style={{ position: "relative", aspectRatio: ratio, overflow: "hidden", borderRadius: 6, background: "#0D0B09", border: "1px solid var(--border)" }}>
      <HeroBgLayer photos={[photo]} />
      <div style={{ position: "absolute", left: "7%", top: "50%", transform: "translateY(-50%)", color: "var(--text-primary)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, lineHeight: 0.92, fontSize: title ? "clamp(18px, 4.2vw, 44px)" : 13 }}>
          Sushi<br />Syndicate
        </div>
        {title && <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", color: "var(--text-secondary)", fontSize: "clamp(9px, 1.4vw, 15px)", marginTop: 6 }}>смакуй кожен момент</div>}
      </div>
      <span style={{ position: "absolute", right: 6, bottom: 4, fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.5)" }}>
        {title ? "ДЕСКТОП" : "ТЕЛЕФОН"}
      </span>
    </div>
  );
}
