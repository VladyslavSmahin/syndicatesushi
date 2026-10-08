"use client";

import { useEffect, useRef, useState } from "react";
import { uploadCustomerAvatar, removeCustomerAvatar, type CustomerProfile } from "@/features/account";
import { downscaleImage } from "@/lib/clientImage";
import ProfileBgEditor from "./ProfileBgEditor";
import AvatarEditor from "./AvatarEditor";

const ERR: Record<string, string> = {
  unauthorized: "Сесія завершилась — увійдіть знову.",
  too_large: "Фото завелике.",
  image_processing_failed: "Не вдалося обробити фото (спробуйте JPEG або PNG).",
  rate_limited: "Забагато спроб — зачекайте хвилину.",
  save_failed: "Фото не збереглося в профілі. Спробуйте пізніше.",
  upload_failed: "Не вдалося зберегти файл. Спробуйте ще раз.",
  r2_not_configured: "Сховище фото не налаштоване.",
};

const R = 42;
const C = 2 * Math.PI * R;

/** Шапка кабінету: фото в кільці заповненості профілю, ім'я, чого бракує (кожен пункт — +20%). */
export default function ProfileHero({ profile, ordersCount, onChanged }: {
  profile: CustomerProfile;
  ordersCount: number;
  onChanged: () => void;
}) {
  const photo = profile.avatarUrl ?? profile.googleAvatar;
  const steps = [
    { label: "ім'я", done: !!profile.name?.trim() },
    { label: "телефон", done: !!profile.phone?.trim() },
    { label: "підтверджена пошта", done: profile.emailConfirmed },
    { label: "фото", done: !!photo },
    { label: "перше замовлення", done: ordersCount > 0 },
  ];
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  const missing = steps.filter((s) => !s.done);

  // кільце «дорисовується» від нуля після появи
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(pct)); return () => cancelAnimationFrame(t); }, [pct]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [editing, setEditing] = useState<File | null>(null); // фото, що зараз кадруємо перед завантаженням
  const [err, setErr] = useState("");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { setErr("Це не зображення."); return; }
    setErr("");
    // спершу — кадр під коло й корекція кольорів, завантаження вже після «Зберегти»
    setEditing(await downscaleImage(file, 2000, 0.92));
  };

  const uploadEdited = async (result: File) => {
    setEditing(null);
    setBusy(true); setErr("");
    const code = await uploadCustomerAvatar(result);
    setBusy(false);
    if (code) setErr(ERR[code] ?? "Не вдалося завантажити фото. Спробуйте ще раз.");
    else onChanged();
  };

  const removePhoto = async () => {
    setBusy(true); setErr("");
    const ok = await removeCustomerAvatar();
    setBusy(false);
    if (ok) onChanged(); else setErr("Не вдалося прибрати фото.");
  };

  const full = pct === 100;
  const initial = (profile.name?.trim() || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="profile-hero">
      <button type="button" className="ph-avatar" onClick={() => fileRef.current?.click()} disabled={busy}
        aria-label={photo ? "Змінити фото профілю" : "Додати фото профілю"} title={photo ? "Змінити фото" : "Додати фото"}>
        <svg viewBox="0 0 100 100" className="ph-ring" aria-hidden>
          <defs>
            <linearGradient id="ph-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E9D7A0" /><stop offset="100%" stopColor="var(--gold)" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={R} className="ph-ring-bg" />
          <circle cx="50" cy="50" r={R} className="ph-ring-fg" stroke="url(#ph-grad)"
            strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
        </svg>
        <span className="ph-photo">
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt="" referrerPolicy="no-referrer" />
            : <span className="ph-initial">{initial}</span>}
          {busy && <span className="ph-busy skel" />}
        </span>
        <span className="ph-cam" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" onChange={onFile} style={{ display: "none" }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ph-name">{profile.name?.trim() || "Гість Syndicate"}</div>
        <div className={`ph-pct${full ? " full" : ""}`}>
          {full ? "✓ Профіль заповнено" : `Профіль заповнено на ${pct}%`}
        </div>
        {!full && (
          <div className="ph-missing">
            {missing.map((m) => <span key={m.label}>+ {m.label}</span>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setBgOpen(true)} className="ph-bg-btn">🎨 Фон кабінету</button>
          {profile.avatarUrl && !busy && (
            <button type="button" onClick={removePhoto} className="ph-link">Прибрати фото</button>
          )}
        </div>
        {err && <div style={{ fontSize: 12, color: "#E0726A", marginTop: 4 }}>{err}</div>}
      </div>
      {editing && <AvatarEditor file={editing} onCancel={() => setEditing(null)} onDone={uploadEdited} />}
      {bgOpen && (
        <ProfileBgEditor current={profile.profileBg} name={profile.name?.trim() ?? ""} onClose={() => setBgOpen(false)} onSaved={onChanged} />
      )}
    </div>
  );
}
