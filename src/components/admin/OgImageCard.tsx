"use client";

import { useRef, useState } from "react";
import { useDbOgImage, dbSaveOgImage, dbUploadImage } from "@/features/admin/db";
import { downscaleImage } from "@/lib/clientImage";
import { OG_IMAGE } from "@/lib/seo";
import s from "./admin.module.css";

const MAX_UPLOAD = 4 * 1024 * 1024; // ліміт тіла запиту Vercel ~4.5 МБ

const ERR: Record<string, string> = {
  unauthorized: "Немає доступу (увійдіть як співробітник).",
  r2_not_configured: "Сховище R2 не налаштоване (ключі Cloudflare).",
  too_large: "Файл завеликий.",
  image_processing_failed: "Не вдалося обробити зображення (спробуйте JPEG або PNG).",
  upload_failed: "Помилка завантаження у сховище.",
};

/** Картинка, яку показують Telegram, Viber, Facebook… при вставці посилання на сайт (Open Graph). */
export default function OgImageCard() {
  const { url, loading, refetch } = useDbOgImage();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = url ?? OG_IMAGE;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNote(null);
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { setNote({ ok: false, text: "Це не зображення." }); return; }
    setBusy("Завантаження…");
    // у браузері — лише зменшуємо до розумного розміру; обрізку 1200×630 і JPEG робить сервер
    let prepared = await downscaleImage(file, 2400, 0.92);
    if (prepared.size > MAX_UPLOAD) prepared = await downscaleImage(file, 2400, 0.82);
    if (prepared.size > MAX_UPLOAD) { setBusy(""); setNote({ ok: false, text: "Файл завеликий навіть після стиснення." }); return; }
    const { url: uploaded, error } = await dbUploadImage(prepared, "og");
    if (!uploaded) { setBusy(""); setNote({ ok: false, text: ERR[error ?? ""] ?? `Помилка: ${error}` }); return; }
    const err = await dbSaveOgImage(uploaded);
    setBusy("");
    if (err) { setNote({ ok: false, text: "Помилка збереження: " + err }); return; }
    setNote({ ok: true, text: "Збережено. Нові посилання підхоплять картинку за кілька хвилин." });
    refetch();
  };

  const reset = async () => {
    setBusy("Скидання…");
    const err = await dbSaveOgImage(null);
    setBusy("");
    if (err) { setNote({ ok: false, text: "Помилка збереження: " + err }); return; }
    setNote({ ok: true, text: "Повернено стандартну картинку." });
    refetch();
  };

  return (
    <div className={s.card}>
      <div className={s.cardHead}><div className={s.cardTitle}>Картинка для посилання в месенджерах</div></div>
      <div style={{ padding: "clamp(14px, 4vw, 22px)", display: "flex", flexDirection: "column", gap: 14 }}>
        <p className={s.hint} style={{ margin: 0 }}>
          Її показують Telegram, Viber, Facebook, Instagram, коли хтось вставляє посилання на сайт. Найкраще — горизонтальне фото;
          воно автоматично обріжеться до 1200×630 по центру, тож важливе тримайте посередині.
          Для сторінок страв береться фото самої страви, ця картинка — лише якщо фото немає.
        </p>

        <div style={{ width: "100%", maxWidth: 520, aspectRatio: "1200 / 630", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
          {!loading && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="Картинка превʼю посилання" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )}
        </div>
        <span className={s.hint} style={{ fontSize: 11 }}>{loading ? "Завантаження…" : url ? "Своя картинка" : "Стандартна картинка сайту"}</span>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" onChange={onFile} style={{ display: "none" }} />
          <button className={s.btn} onClick={() => fileRef.current?.click()} disabled={!!busy || loading}>
            {busy || "Завантажити нову"}
          </button>
          {url && (
            <button className={`${s.btn} ${s.btnGhost}`} onClick={reset} disabled={!!busy}>Повернути стандартну</button>
          )}
        </div>
        {note && <p style={{ margin: 0, fontSize: 13, color: note.ok ? "#5BB85B" : "#E0726A" }}>{note.text}</p>}
        <p className={s.hint} style={{ margin: 0, fontSize: 11 }}>
          Месенджери запамʼятовують превʼю. Щоб Telegram оновив уже надіслане посилання — перешліть його боту @WebpageBot.
        </p>
      </div>
    </div>
  );
}
