"use client";

import { useEffect, useState } from "react";
import { pushApi, pushAvailable } from "@/lib/pushClient";
import s from "./admin.module.css";

const TITLE_MAX = 60;
const BODY_MAX = 180;

/** «Акції» → пуш-розсилка клієнтам, що погодились на акції (кабінет → «Сповіщення»). Лише admin. */
export default function PromoPushCard() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    pushApi<{ audience: number }>("admin", { action: "promo-audience" }).then((r) => setAudience(r.audience)).catch(() => setAudience(null));
  }, [open]);

  if (!pushAvailable()) return null;
  const urlOk = !url.trim() || /^\/(?![/\\])[^\s\\]{0,200}$/.test(url.trim());
  const valid = title.trim() && body.trim() && urlOk;

  const send = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await pushApi<{ recipients: number; sent: number }>("admin", { action: "promo", title, body, url });
      setMsg(`Надіслано: ${r.sent} з ${r.recipients}`);
      setTitle(""); setBody(""); setUrl("");
    } catch {
      setMsg("Не вдалося надіслати.");
    } finally {
      setBusy(false); setConfirm(false);
    }
  };

  return (
    <div className={s.card}>
      <button type="button" className={`${s.cardHead} ${s.navGroupToggle}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={s.cardTitle}>📣 Пуш-розсилка клієнтам</span>
        <span className={s.hint} style={{ fontSize: 12 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className={s.hint} style={{ margin: 0, fontSize: 13 }}>
            Отримають клієнти, які в кабінеті ввімкнули «Акції та новинки»
            {audience !== null ? <> — зараз <b>{audience}</b> пристр.</> : null}. Не надсилайте частіше кількох разів на місяць — інакше вимикатимуть.
          </p>
          <input className={s.input} placeholder="Заголовок, напр. «−20% на сети сьогодні»" maxLength={TITLE_MAX} value={title}
            onChange={(e) => { setTitle(e.target.value); setConfirm(false); }} />
          <textarea className={s.input} rows={2} placeholder="Текст" maxLength={BODY_MAX} value={body}
            onChange={(e) => { setBody(e.target.value); setConfirm(false); }} />
          <input className={s.input} placeholder="Посилання на сторінку сайту (необов'язково), напр. /menu" value={url}
            onChange={(e) => { setUrl(e.target.value); setConfirm(false); }} />
          {!urlOk && <p className={s.error} style={{ margin: 0, fontSize: 13 }}>Лише сторінка нашого сайту, що починається з «/».</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!confirm ? (
              <button type="button" className={s.btn} disabled={!valid || busy || audience === 0} onClick={() => setConfirm(true)}>Надіслати</button>
            ) : (
              <>
                <button type="button" className={s.btn} disabled={busy} onClick={send}>{busy ? "Надсилаємо…" : `Так, надіслати ${audience ?? ""}`}</button>
                <button type="button" className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => setConfirm(false)}>Скасувати</button>
              </>
            )}
            {msg && <span className={s.hint} style={{ fontSize: 13 }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
