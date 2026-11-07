"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyItem, LoyaltySection } from "@/lib/loyaltyProgram";
import s from "@/components/admin/admin.module.css";

// Концепція лояльності: картка на розділ, у кожного пункту ✎ — коментар адміна (таблиця loyalty_comments, RLS — лише admin).

type Comment = {
  id: string;
  item_key: string;
  body: string;
  author_id: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
};

const MAX = 4000;
const TAG_COLOR: Record<string, string> = { "перевірено": "#8fc98f", "не перевірено": "#e0b36a", "підтвердити": "#e0b36a" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const who = (email: string | null) => (email ? email.split("@")[0] : "адмін");

export default function LoyaltyClient({ sections, version, uid }: { sections: LoyaltySection[]; version: string; uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("loyalty_comments")
      .select("id, item_key, body, author_id, author_email, created_at, updated_at")
      .order("created_at");
    setLoadError(error ? error.message : null);
    if (!error) setComments((data ?? []) as Comment[]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);

  const byItem = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) m.set(c.item_key, [...(m.get(c.item_key) ?? []), c]);
    return m;
  }, [comments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className={s.hint}>
        {version}. Біля кожного пункту ✎ — додати коментар (бачать лише адміністратори).
        {!loading && ` Коментарів: ${comments.length}.`}
      </div>
      {loadError && <div className={s.hint} style={{ color: "#E0726A" }}>Коментарі не завантажились: {loadError}</div>}

      {sections.map((sec) => (
        <div key={sec.key} className={s.card}>
          <div className={s.cardHead}><div className={s.cardTitle}>{sec.title}</div></div>
          <div style={{ padding: "8px 22px 14px" }}>
            {sec.note && <p className={s.hint} style={{ margin: "10px 0 4px" }}>{sec.note}</p>}
            {sec.items.map((it, i) => (
              <ItemRow key={it.key} item={it} first={i === 0} comments={byItem.get(it.key) ?? []} uid={uid}
                supabase={supabase} onChanged={refetch} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ item, first, comments, uid, supabase, onChanged }: {
  item: LoyaltyItem;
  first: boolean;
  comments: Comment[];
  uid: string;
  supabase: ReturnType<typeof createClient>;
  onChanged: () => Promise<void>;
}) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = () => { setEditId(null); setDraft(""); setComposing((v) => !v || editId !== null); };
  const openEdit = (c: Comment) => { setEditId(c.id); setDraft(c.body); setComposing(true); };
  const close = () => { setComposing(false); setEditId(null); setDraft(""); };

  const save = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = editId
      ? await supabase.from("loyalty_comments").update({ body }).eq("id", editId)
      : await supabase.from("loyalty_comments").insert({ item_key: item.key, body });
    setBusy(false);
    if (error) { alert("Не вдалося зберегти: " + error.message); return; }
    close();
    await onChanged();
  };

  const remove = async (c: Comment) => {
    if (!confirm("Видалити коментар?")) return;
    const { error } = await supabase.from("loyalty_comments").delete().eq("id", c.id);
    if (error) { alert("Не вдалося видалити: " + error.message); return; }
    if (editId === c.id) close();
    await onChanged();
  };

  return (
    <div style={{ padding: "14px 0", borderTop: first ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--text-primary)" }}>
            {item.title}
            {item.tag && (
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase", color: TAG_COLOR[item.tag] ?? "var(--text-secondary)" }}>
                {item.tag}
              </span>
            )}
          </div>
          {item.text && <p className={s.hint} style={{ margin: "4px 0 0" }}>{item.text}</p>}
        </div>
        <button type="button" className={s.iconBtn} onClick={openNew}
          aria-label={`Коментар до пункту «${item.title}»`} title="Додати коментар"
          aria-expanded={composing && !editId}
          style={composing && !editId ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>
          <PencilIcon />
        </button>
      </div>

      {comments.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {comments.map((c) => (
            <li key={c.id} style={{ borderLeft: "2px solid var(--accent)", padding: "6px 0 6px 12px", background: "var(--bg-elevated)", borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {who(c.author_email)} · {when(c.created_at)}{c.updated_at !== c.created_at && " · змінено"}
                </span>
                {c.author_id === uid && (
                  <>
                    <button type="button" className={s.iconBtn} style={{ width: 26, height: 26 }} onClick={() => openEdit(c)} aria-label="Редагувати коментар" title="Редагувати"><PencilIcon size={13} /></button>
                    <button type="button" className={`${s.iconBtn} ${s.iconBtnDanger}`} style={{ width: 26, height: 26, marginRight: 8 }} onClick={() => remove(c)} aria-label="Видалити коментар" title="Видалити"><TrashIcon /></button>
                  </>
                )}
              </div>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.5 }}>{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea className={s.input} rows={3} autoFocus maxLength={MAX} value={draft}
            placeholder={editId ? "Текст коментаря" : "Коментар до пункту: рішення, питання, цифри…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
            style={{ resize: "vertical", lineHeight: 1.5, maxWidth: "100%" }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className={s.btn} onClick={save} disabled={busy || !draft.trim()}>
              {busy ? "Збереження…" : editId ? "Зберегти" : "Додати"}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={close} disabled={busy}>Скасувати</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
