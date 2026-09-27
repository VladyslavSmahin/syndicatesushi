"use client";

import { useEffect, useMemo, useState } from "react";
import { useDbContacts, dbSaveContacts } from "@/features/admin/db";
import { CONTACT_ENTRIES, SOCIAL_KEYS, isValidSocialUrl, telHref } from "@/lib/contacts";
import s from "@/components/admin/admin.module.css";

export default function ContactsPage() {
  const { contacts, loading, refetch } = useDbContacts();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading) setDraft({ ...contacts }); }, [loading, contacts]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof CONTACT_ENTRIES>();
    for (const e of CONTACT_ENTRIES) {
      const arr = map.get(e.group) ?? [];
      arr.push(e); map.set(e.group, arr);
    }
    return [...map.entries()];
  }, []);

  // соцмережі: лише https-посилання (інше на сайті все одно відкидається)
  const isSocial = (key: string) => (SOCIAL_KEYS as readonly string[]).includes(key);
  const invalidSocial = SOCIAL_KEYS.filter((k) => !isValidSocialUrl(draft[k] ?? ""));

  const dirty = CONTACT_ENTRIES.some((e) => (draft[e.key] ?? "") !== (contacts[e.key] ?? ""));

  const save = async () => {
    if (invalidSocial.length) return;
    setSaving(true);
    // порожнє поле → дефолт (для соцмереж дефолт порожній, тобто іконка ховається)
    const out: Record<string, string> = {};
    for (const e of CONTACT_ENTRIES) {
      // додаткові телефони: порожнє поле = номера немає (дефолт у них теж порожній)
      out[e.key] = (draft[e.key]?.trim() || e.default);
    }
    const err = await dbSaveContacts(out);
    setSaving(false);
    if (err) { alert("Помилка збереження: " + err); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    refetch();
  };

  const reset = () => setDraft(Object.fromEntries(CONTACT_ENTRIES.map((e) => [e.key, e.default])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Контакти показуються на сайті (шапка, футер, мобільне меню, блок з картою) і в юридичних
        сторінках — «Оферта» та «Політика конфіденційності». Посилання на соцмережі: порожнє поле —
        іконка не показується.
      </p>

      {loading ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : (
        <>
          {groups.map(([group, entries]) => (
            <div key={group} className={s.card}>
              <div className={s.cardHead}><div className={s.cardTitle}>{group}</div></div>
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                {entries.filter((e) => !e.flag).map((e) => (
                  <div key={e.key} className={s.field}>
                    <span className={s.fieldLabel}>{e.label}</span>
                    <input
                      className={s.input}
                      placeholder={e.placeholder ?? e.default}
                      value={draft[e.key] ?? ""}
                      onChange={(ev) => setDraft((d) => ({ ...d, [e.key]: ev.target.value }))}
                    />
                    {e.visibleKey && (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, cursor: "pointer", opacity: draft[e.key]?.trim() ? 1 : 0.5 }}>
                        <input
                          type="checkbox"
                          checked={draft[e.visibleKey] !== "0"}
                          onChange={(ev) => setDraft((d) => ({ ...d, [e.visibleKey!]: ev.target.checked ? "1" : "0" }))}
                        />
                        Показувати на сайті
                      </label>
                    )}
                    {isSocial(e.key) && !isValidSocialUrl(draft[e.key] ?? "") && (
                      <span className={s.error} style={{ fontSize: 12, marginTop: 4 }}>
                        Посилання має починатися з https://
                      </span>
                    )}
                    {e.hint && <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>{e.hint}</span>}
                    {(e.key === "phone" || e.visibleKey) && (draft[e.key]?.trim() || "") !== "" && (
                      <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>
                        Посилання для дзвінка: {telHref(draft[e.key])}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className={s.btn} onClick={save} disabled={saving || !dirty || invalidSocial.length > 0}>{saving ? "Збереження…" : "Зберегти"}</button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={reset} disabled={saving}>Скинути до дефолтних</button>
            {saved && <span className={s.hint} style={{ color: "#8fc98f" }}>Збережено ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}
