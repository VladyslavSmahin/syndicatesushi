"use client";

import { useEffect, useState } from "react";
import { useDbTikTok, dbSaveTikTok, dbFetchTikTokVideo, dbSyncTikTok } from "@/features/admin/db";
import type { TikTokBlock } from "@/lib/tiktok";
import s from "@/components/admin/admin.module.css";

const ERR: Record<string, string> = {
  unauthorized: "Немає доступу (увійдіть як співробітник).",
  bad_url: "Це не посилання на TikTok.",
  not_video: "Не знайшли ролик за цим посиланням. Скопіюйте посилання саме на відео (Поділитися → Копіювати посилання).",
  oembed_failed: "TikTok не віддав дані ролика. Можливо, відео приватне або вимкнене вбудовування. Спробуйте пізніше.",
  thumb_fetch_failed: "Не вдалося завантажити обкладинку з TikTok.",
  r2_not_configured: "Сховище R2 не налаштоване.",
  tiktok_unavailable: "TikTok зараз не відповідає (у нього захист від частих запитів). Спробуйте за кілька хвилин — на сайті поки лишається попередній список.",
  empty_list: "TikTok віддав порожній список роликів.",
  not_auto: "Спершу оберіть режим «Автоматично» і вкажіть акаунт.",
  busy: "Оновлення вже йде — зачекайте.",
};

const MAX_VIDEOS = 12;

/** Блок «Ми в TikTok» на головній (під відгуками). */
export default function TikTokAdminPage() {
  const { block, loading, refetch } = useDbTikTok();
  const [draft, setDraft] = useState<TikTokBlock | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (!loading) setDraft(structuredClone(block)); }, [loading, block]);

  const persist = async (next: TikTokBlock, okText: string) => {
    setDraft(next);
    const err = await dbSaveTikTok(next);
    if (err) { setNote({ ok: false, text: "Помилка збереження: " + err }); return; }
    setNote({ ok: true, text: okText });
    refetch();
  };

  const addVideo = async () => {
    if (!draft || !link.trim()) return;
    if (draft.videos.length >= MAX_VIDEOS) { setNote({ ok: false, text: `Максимум ${MAX_VIDEOS} роликів.` }); return; }
    setBusy("Завантажуємо ролик…"); setNote(null);
    const { video, error } = await dbFetchTikTokVideo(link.trim());
    setBusy("");
    if (!video) { setNote({ ok: false, text: ERR[error ?? ""] ?? `Помилка: ${error}` }); return; }
    if (draft.videos.some((v) => v.id === video.id)) { setNote({ ok: false, text: "Цей ролик уже в списку." }); return; }
    setLink("");
    await persist({ ...draft, videos: [video, ...draft.videos] }, "Ролик додано — на сайті зʼявиться за хвилину.");
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.videos.length) return;
    const videos = [...draft.videos];
    [videos[i], videos[j]] = [videos[j], videos[i]];
    persist({ ...draft, videos }, "Порядок збережено.");
  };

  const remove = (i: number) => {
    if (!draft) return;
    persist({ ...draft, videos: draft.videos.filter((_, k) => k !== i) }, "Ролик прибрано.");
  };

  if (loading || !draft) {
    return <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Блок «Ми в TikTok» на головній під відгуками. Досить вказати акаунт — у режимі «Автоматично» нові ролики
        зʼявляються на сайті самі, вручну нічого додавати не треба.
      </p>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Налаштування</div></div>
        <div style={{ padding: "clamp(14px, 4vw, 22px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={draft.enabled} onChange={(e) => persist({ ...draft, enabled: e.target.checked }, e.target.checked ? "Блок увімкнено." : "Блок вимкнено.")} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Показувати блок на сайті</span>
          </label>
          <div className={s.field}>
            <span className={s.fieldLabel}>Що показувати</span>
            {([
              ["auto", "Автоматично — стрічка в стилі сайту", "Останні ролики акаунта підтягуються самі (раз на ~2 години), відео грає прямо на сайті. Поки ролики не підтягнулись — показуємо віджет TikTok."],
              ["widget", "Віджет TikTok", "Офіційна світла картка TikTok з останніми роликами; тап по ролику відкриває TikTok."],
              ["videos", "Вибрані ролики вручну", "Самі обираєте ролики (посилання нижче); відео грає прямо на сайті."],
            ] as const).map(([m, label, hint]) => (
              <label key={m} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "6px 0" }}>
                <input type="radio" name="tt-mode" checked={draft.mode === m} style={{ marginTop: 3 }}
                  onChange={() => persist({ ...draft, mode: m }, m === "auto" ? "Автоматичний режим. Натисніть «Оновити зараз», щоб підтягнути ролики одразу." : m === "widget" ? "Показуємо віджет TikTok." : "Показуємо вибрані ролики.")} />
                <span>
                  <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
                  <span className={s.hint} style={{ fontSize: 11 }}>{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>Посилання на акаунт</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className={s.input} style={{ flex: "1 1 220px" }} placeholder="https://www.tiktok.com/@sushi_syndicate" value={draft.profileUrl}
                onChange={(e) => setDraft({ ...draft, profileUrl: e.target.value })} />
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => persist(draft, "Посилання збережено.")}>Зберегти</button>
            </div>
          </div>
        </div>
      </div>

      {draft.mode === "auto" && (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div className={s.cardTitle}>Підтягнуті ролики · {draft.autoVideos.length}</div>
            <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} disabled={!!busy || !draft.profileUrl} onClick={async () => {
              setBusy("Оновлюємо…"); setNote(null);
              const r = await dbSyncTikTok();
              setBusy("");
              setNote(r.ok ? { ok: true, text: `Готово: ${r.count} роликів${r.added ? `, нових — ${r.added}` : ""}.` } : { ok: false, text: ERR[r.error ?? ""] ?? `Помилка: ${r.error}` });
              refetch();
            }}>{busy || "↻ Оновити зараз"}</button>
          </div>
          <div style={{ padding: "clamp(14px, 4vw, 22px)", display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={s.hint} style={{ fontSize: 11 }}>
              {draft.syncedAt ? `Останнє оновлення: ${new Date(draft.syncedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Ще не оновлювались."}
            </span>
            {note && <p style={{ margin: 0, fontSize: 13, color: note.ok ? "#5BB85B" : "#E0726A" }}>{note.text}</p>}
            {draft.autoVideos.length > 0 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {draft.autoVideos.map((v) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" title={v.title}><img src={v.thumb} alt="" style={{ width: 54, height: 96, objectFit: "cover", borderRadius: 6, display: "block" }} /></a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {draft.mode === "videos" && (
      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Ролики · {draft.videos.length}</div></div>
        <div style={{ padding: "clamp(14px, 4vw, 22px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className={s.input} style={{ flex: "1 1 220px" }} placeholder="https://www.tiktok.com/@…/video/…" value={link}
              onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addVideo(); }} />
            <button className={s.btn} onClick={addVideo} disabled={!!busy || !link.trim()}>{busy || "+ Додати"}</button>
          </div>
          {note && <p style={{ margin: 0, fontSize: 13, color: note.ok ? "#5BB85B" : "#E0726A" }}>{note.text}</p>}

          {draft.videos.length === 0 ? (
            <p className={s.hint} style={{ margin: 0 }}>Поки немає роликів — у цьому режимі блок на сайті не показується.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {draft.videos.map((v, i) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt="" style={{ width: 40, height: 71, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  <a href={v.url} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", textDecoration: "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {v.title || v.url}
                  </a>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Вище">↑</button>
                    <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => move(i, 1)} disabled={i === draft.videos.length - 1} aria-label="Нижче">↓</button>
                    <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => remove(i)} aria-label="Прибрати">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
