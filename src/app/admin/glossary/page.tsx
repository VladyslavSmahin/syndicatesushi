"use client";

import { useEffect, useMemo, useState } from "react";
import { useDbGlossary, dbSaveGlossary } from "@/features/admin/db";
import { GLOSSARY_ENTRIES } from "@/lib/glossary";
import s from "@/components/admin/admin.module.css";

export default function GlossaryPage() {
  const { glossary, loading, refetch } = useDbGlossary();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading) setDraft({ ...glossary }); }, [loading, glossary]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof GLOSSARY_ENTRIES>();
    for (const e of GLOSSARY_ENTRIES) {
      const arr = map.get(e.group) ?? [];
      arr.push(e); map.set(e.group, arr);
    }
    return [...map.entries()];
  }, []);

  const dirty = GLOSSARY_ENTRIES.some((e) => (draft[e.key] ?? "") !== (glossary[e.key] ?? ""));

  const save = async () => {
    setSaving(true);
    // порожні поля → дефолт
    const out: Record<string, string> = {};
    for (const e of GLOSSARY_ENTRIES) out[e.key] = (draft[e.key]?.trim() || e.default);
    const err = await dbSaveGlossary(out);
    setSaving(false);
    if (err) { alert("Помилка збереження: " + err); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    refetch();
  };

  const reset = () => setDraft(Object.fromEntries(GLOSSARY_ENTRIES.map((e) => [e.key, e.default])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Глосарій — назви/підписи сутностей, які не редагуються в інших розділах (бейджі, заголовки блоків,
        пункти навігації тощо). Порожнє поле = значення за замовчуванням. Категорії, підкатегорії, товари
        та інгредієнти змінюються у своїх розділах.
      </p>

      {loading ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : (
        <>
          {groups.map(([group, entries]) => (
            <div key={group} className={s.card}>
              <div className={s.cardHead}><div className={s.cardTitle}>{group}</div></div>
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                {entries.map((e) => (
                  <div key={e.key} className={s.field}>
                    <span className={s.fieldLabel}>{e.label}</span>
                    <input className={s.input} placeholder={e.default}
                      value={draft[e.key] ?? ""} onChange={(ev) => setDraft((d) => ({ ...d, [e.key]: ev.target.value }))} />
                    {e.hint && <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>{e.hint}</span>}
                    {(draft[e.key]?.trim() || e.default) !== e.default && (
                      <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>За замовчуванням: «{e.default}»</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className={s.btn} onClick={save} disabled={saving || !dirty}>{saving ? "Збереження…" : "Зберегти"}</button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={reset} disabled={saving}>Скинути до дефолтних</button>
            {saved && <span className={s.hint} style={{ color: "#8fc98f" }}>Збережено ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}
