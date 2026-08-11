"use client";

import { useEffect, useState } from "react";
import { useDbSeoBlock, dbSaveSeoBlock } from "@/features/admin/db";
import { DEFAULT_SEO_BLOCK, type SeoBlock, type FaqItem } from "@/lib/seoBlock";
import s from "@/components/admin/admin.module.css";

export default function SeoTextPage() {
  const { seoBlock, loading, refetch } = useDbSeoBlock();
  const [draft, setDraft] = useState<SeoBlock | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading) setDraft(structuredClone(seoBlock)); }, [loading, seoBlock]);

  const set = <K extends keyof SeoBlock>(key: K, value: SeoBlock[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const setFaq = (i: number, key: keyof FaqItem, value: string) =>
    setDraft((d) => (d ? { ...d, faq: d.faq.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)) } : d));

  const addFaq = () => setDraft((d) => (d ? { ...d, faq: [...d.faq, { q: "", a: "" }] } : d));
  const removeFaq = (i: number) => setDraft((d) => (d ? { ...d, faq: d.faq.filter((_, idx) => idx !== i) } : d));
  const moveFaq = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.faq.length) return d;
      const faq = [...d.faq];
      [faq[i], faq[j]] = [faq[j], faq[i]];
      return { ...d, faq };
    });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    // порожні пари не зберігаємо — інакше на сайті будуть пусті рядки
    const clean: SeoBlock = { ...draft, faq: draft.faq.filter((f) => f.q.trim() && f.a.trim()) };
    const err = await dbSaveSeoBlock(clean);
    setSaving(false);
    if (err) { alert("Помилка збереження: " + err); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    refetch();
  };

  const reset = () => setDraft(structuredClone(DEFAULT_SEO_BLOCK));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Текстовий блок унизу головної сторінки. Потрібен для пошуку: Google читає цей текст і питання-відповіді,
        щоб зрозуміти, що ми доставляємо суші саме в Тульчині. Пишіть звичайною мовою, як пояснювали б клієнту —
        перелік ключових слів без сенсу шкодить, а не допомагає. Абзаци розділяються порожнім рядком.
      </p>

      {loading || !draft ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : (
        <>
          <div className={s.card}>
            <div className={s.cardHead}><div className={s.cardTitle}>Текст</div></div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Показувати блок на сайті</span>
              </label>

              <div className={s.field}>
                <span className={s.fieldLabel}>Заголовок</span>
                <input className={s.input} value={draft.title} placeholder={DEFAULT_SEO_BLOCK.title}
                  onChange={(e) => set("title", e.target.value)} />
              </div>

              <div className={s.field}>
                <span className={s.fieldLabel}>Опис</span>
                <textarea className={s.input} rows={12} style={{ resize: "vertical", lineHeight: 1.6, maxWidth: "100%" }}
                  value={draft.text} onChange={(e) => set("text", e.target.value)} />
                <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>
                  Порожній рядок між абзацами. Зараз абзаців: {draft.text.split(/\n\s*\n/).filter((p) => p.trim()).length}
                </span>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>Часті запитання</div>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={addFaq}>+ Питання</button>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
              <p className={s.hint} style={{ margin: 0 }}>
                Ці питання Google може показати прямо у видачі. Відповідайте конкретно (час, ціна, умови) —
                загальні фрази пошук ігнорує.
              </p>

              {draft.faq.length === 0 && <p className={s.hint}>Питань немає. Додайте перше кнопкою вище.</p>}

              {draft.faq.map((item, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span className={s.fieldLabel} style={{ margin: 0 }}>Питання {i + 1}</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => moveFaq(i, -1)} disabled={i === 0}>↑</button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => moveFaq(i, 1)} disabled={i === draft.faq.length - 1}>↓</button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => removeFaq(i)}>Видалити</button>
                    </div>
                  </div>
                  <input className={s.input} placeholder="Скільки часу займає доставка?"
                    value={item.q} onChange={(e) => setFaq(i, "q", e.target.value)} />
                  <textarea className={s.input} rows={3} style={{ resize: "vertical", lineHeight: 1.6, maxWidth: "100%" }}
                    placeholder="Зазвичай 40–60 хвилин…"
                    value={item.a} onChange={(e) => setFaq(i, "a", e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className={s.btn} onClick={save} disabled={saving}>{saving ? "Збереження…" : "Зберегти"}</button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={reset} disabled={saving}>Повернути рекомендований текст</button>
            {saved && <span className={s.hint} style={{ color: "#8fc98f" }}>Збережено ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}
