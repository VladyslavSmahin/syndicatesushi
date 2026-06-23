"use client";

import { useEffect, useRef, useState } from "react";
import {
  useDbBanners, dbUploadBanner, dbDeleteBanner, dbSetBannerActive, dbReorderBanners,
  type DbBanner,
} from "@/features/admin/db";
import s from "@/components/admin/admin.module.css";
import { downscaleImage } from "@/lib/clientImage";

const MAX_MB = 8;

// Помилки з API → людські підписи.
const ERR: Record<string, string> = {
  unauthorized: "Немає доступу (увійдіть як співробітник).",
  r2_not_configured: "Сховище R2 не налаштоване (ключі Cloudflare).",
  too_large: `Файл завеликий (макс. ${MAX_MB} МБ).`,
  bad_image: "Не вдалося обробити зображення.",
  upload_failed: "Помилка завантаження у сховище.",
  db_failed: "Помилка бази даних.",
};
const errText = (e: string) => ERR[e] ?? `Помилка: ${e}`;

// квадратна кнопка-стрілка
const arrowBtn: React.CSSProperties = {
  width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: 0, fontSize: 16, lineHeight: 1, borderRadius: 8,
  border: "1px solid var(--border)", background: "rgba(255,255,255,0.04)",
  color: "var(--text-primary)", cursor: "pointer",
};

export default function BannersPanel() {
  const { banners, loading, refetch } = useDbBanners();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // локальний порядок для миттєвого drag-and-drop (синхронізується з БД)
  const [items, setItems] = useState<DbBanner[]>([]);
  useEffect(() => { setItems(banners); }, [banners]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // дозволити повторний вибір того ж файлу
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Оберіть зображення."); return; }
    setBusy(true);
    // стискаємо у браузері до відправки (обхід ліміту тіла запиту Vercel ~4.5 МБ)
    const prepared = await downscaleImage(file, 2000, 0.85);
    if (prepared.size > 4 * 1024 * 1024) {
      setBusy(false);
      setError("Файл завеликий навіть після стиснення. Оберіть інше зображення.");
      return;
    }
    const err = await dbUploadBanner(prepared);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    refetch();
  };

  const toggle = async (b: DbBanner) => { await dbSetBannerActive(b.id, !b.isActive); refetch(); };

  const remove = async (b: DbBanner) => {
    if (!confirm("Видалити банер?")) return;
    const err = await dbDeleteBanner(b.id);
    if (err) { setError(errText(err)); return; }
    refetch();
  };

  // зберегти новий порядок (масив id) — оптимістично + у БД
  const persistOrder = async (next: DbBanner[]) => {
    setItems(next);
    await dbReorderBanners(next.map((b) => b.id));
    refetch();
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next);
  };

  const onDrop = (targetId: string) => {
    setOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const from = items.findIndex((b) => b.id === dragId);
    const to = items.findIndex((b) => b.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardTitle}>Баннери ({items.length})</div>
        <button className={`${s.btn} ${s.btnSmall}`} onClick={pick} disabled={busy}>
          {busy ? "Завантаження…" : "+ Завантажити банер"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      <p className={s.hint} style={{ margin: "0 0 14px" }}>
        Клієнт сам готує банер як картинку — тут лише завантаження. Сайт автоматично конвертує
        у <code>WebP</code> і кладе у сховище. Активні банери показуються в слайдері на головній,
        у заданому порядку. Порядок — перетягніть картку або стрілками ↑/↓. Рекомендований формат —
        горизонтальний (16:9), до {MAX_MB} МБ.
      </p>

      {error && <p className={s.hint} style={{ color: "var(--danger, #e35)", margin: "0 0 14px" }}>{error}</p>}

      {loading ? (
        <p className={s.hint} style={{ margin: 0 }}>Завантаження…</p>
      ) : items.length === 0 ? (
        <p className={s.hint} style={{ margin: 0 }}>Поки немає банерів. Завантажте перший.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {items.map((b, i) => {
            const dragging = dragId === b.id;
            const over = overId === b.id && dragId !== b.id;
            return (
              <div
                key={b.id}
                draggable
                onDragStart={() => setDragId(b.id)}
                onDragEnter={() => setOverId(b.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDrop={() => onDrop(b.id)}
                style={{
                  border: over ? "2px solid var(--accent)" : "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 12, overflow: "hidden", background: "#15110E",
                  boxShadow: dragging ? "0 0 0 2px var(--accent)" : "0 6px 20px rgba(0,0,0,0.45)",
                  opacity: dragging ? 0.5 : b.isActive ? 1 : 0.6,
                  transition: "box-shadow 0.15s, opacity 0.15s, border-color 0.15s",
                }}
              >
                <div style={{ position: "relative", cursor: "grab" }} title="Перетягніть, щоб змінити порядок">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imagePath} alt="" draggable={false} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
                  <span style={{
                    position: "absolute", top: 8, left: 8, padding: "3px 7px", borderRadius: 6,
                    background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, letterSpacing: 1, userSelect: "none",
                  }}>⠿ {i + 1}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderTop: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap" }}>
                  <button className={`${s.pill} ${b.isActive ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }} onClick={() => toggle(b)}>
                    {b.isActive ? "Активний" : "Прихований"}
                  </button>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <button style={{ ...arrowBtn, opacity: i === 0 ? 0.35 : 1 }} onClick={() => move(i, -1)} disabled={i === 0} title="Вище" aria-label="Вище">↑</button>
                    <button style={{ ...arrowBtn, opacity: i === items.length - 1 ? 0.35 : 1 }} onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Нижче" aria-label="Нижче">↓</button>
                    <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(b)}>Видалити</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
