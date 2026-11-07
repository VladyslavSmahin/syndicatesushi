"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyItem, LoyaltySection, LoyaltyTag } from "@/lib/loyaltyProgram";
import s from "@/components/admin/admin.module.css";

// Концепція лояльності дашбордом: плитки з числами, сходинки рівнів, кроки місяця, рядки правил.
// У кожного пункту ✎ — коментар адміна (таблиця loyalty_comments, RLS — лише admin).

type Comment = {
  id: string;
  item_key: string;
  body: string;
  author_id: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
};
type Supa = ReturnType<typeof createClient>;

const MAX = 4000;
const TAG_COLOR: Record<LoyaltyTag, string> = {
  "перевірено": "#8fc98f",
  "власники": "#9aa7b8",
  "підтвердити": "#e0b36a",
  "гіпотеза": "#e0b36a",
};
const money = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const who = (email: string | null) => (email ? email.split("@")[0] : "адмін");

const tile: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "14px 14px 12px", background: "var(--bg-elevated)",
  display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
};
const grid = (min: number): React.CSSProperties => ({ display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` });
const label: React.CSSProperties = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-secondary)" };
const big: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, lineHeight: 1.1, color: "var(--text-primary)" };
const small: React.CSSProperties = { fontSize: 13, lineHeight: 1.45, color: "var(--text-secondary)" };

export default function LoyaltyClient({ sections, check, uid }: { sections: LoyaltySection[]; check: number; uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("loyalty_comments")
      .select("id, item_key, body, author_id, author_email, created_at, updated_at")
      .order("created_at");
    setLoadError(error ? error.message : null);
    if (!error) setComments((data ?? []) as Comment[]);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);

  const byItem = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) m.set(c.item_key, [...(m.get(c.item_key) ?? []), c]);
    return m;
  }, [comments]);

  const ctx = { byItem, uid, supabase, onChanged: refetch, check };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {loadError && <div className={s.hint} style={{ color: "#E0726A" }}>Коментарі не завантажились: {loadError}</div>}
      {sections.map((sec) => (
        <div key={sec.key} className={s.card}>
          <div className={s.cardHead}><div className={s.cardTitle}>{sec.title}</div></div>
          <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            {sec.note && <div style={small}>{sec.note}</div>}
            {groupByKind(sec.items).map((g) => <Group key={g[0].key} items={g} ctx={ctx} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

type Ctx = { byItem: Map<string, Comment[]>; uid: string; supabase: Supa; onChanged: () => Promise<void>; check: number };

/** Сусідні пункти одного kind — одна сітка */
function groupByKind(items: LoyaltyItem[]) {
  const out: LoyaltyItem[][] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last[0].kind === it.kind) last.push(it); else out.push([it]);
  }
  return out;
}

function Group({ items, ctx }: { items: LoyaltyItem[]; ctx: Ctx }) {
  const kind = items[0].kind;
  if (kind === "level") return <Levels items={items} ctx={ctx} />;
  if (kind === "row") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <Commentable key={it.key} item={it} ctx={ctx}
            style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.title}</span>
              {it.text && <span style={small}>{it.text}</span>}
              <Tag tag={it.tag} />
            </div>
          </Commentable>
        ))}
      </div>
    );
  }
  return (
    <div style={grid(kind === "step" ? 160 : 190)}>
      {items.map((it) => (
        <Commentable key={it.key} item={it} ctx={ctx} style={tile}>
          {kind === "step" ? (
            <>
              <span style={label}>замовлення</span>
              <span style={big}>{it.title}</span>
            </>
          ) : (
            <>
              <span style={label}>{it.title}</span>
              {it.value && <span style={big}>{it.value}</span>}
              {it.bars && <Bars bars={it.bars} />}
            </>
          )}
          {it.text && <span style={small}>{it.text}</span>}
          <Tag tag={it.tag} />
        </Commentable>
      ))}
    </div>
  );
}

/** Сходинки рівнів: шкала порогів + плитки з нагородою і ≈ кількістю замовлень */
function Levels({ items, ctx }: { items: LoyaltyItem[]; ctx: Ctx }) {
  const max = Math.max(...items.map((i) => i.amount ?? 0));
  // корінь — щоб 2 000 / 5 000 / 10 000 не злипались на лінійній шкалі
  const pos = (a: number) => `${(Math.sqrt(a) / Math.sqrt(max)) * 100}%`;
  return (
    <>
      <div style={{ position: "relative", height: 34, margin: "4px 10px 6px" }} aria-hidden="true">
        <div style={{ position: "absolute", left: 0, right: 0, top: 6, height: 4, borderRadius: 2, background: "linear-gradient(90deg, var(--border-light), var(--accent))" }} />
        {items.map((it) => (
          <div key={it.key} style={{ position: "absolute", left: pos(it.amount ?? 0), top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ width: 12, height: 12, margin: "1px auto 0", borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-card)" }} />
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap" }}>{(it.amount ?? 0) / 1000}k</div>
          </div>
        ))}
      </div>
      <div style={grid(190)}>
        {items.map((it) => (
          <Commentable key={it.key} item={it} ctx={ctx} style={tile}>
            <span style={label}>{it.title}</span>
            <span style={big}>{money(it.amount ?? 0)}</span>
            <span style={{ ...small, color: "var(--text-primary)" }}>{it.text}</span>
            <span style={small}>≈ {Math.round((it.amount ?? 0) / ctx.check)} замовлень по {money(ctx.check)}</span>
            <Tag tag={it.tag} />
          </Commentable>
        ))}
      </div>
    </>
  );
}

function Bars({ bars }: { bars: NonNullable<LoyaltyItem["bars"]> }) {
  const max = Math.max(...bars.map((b) => b.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      {bars.map((b) => (
        <div key={b.label} style={{ display: "grid", gridTemplateColumns: "72px 1fr 28px", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <span>{b.label}</span>
          <span style={{ height: 8, borderRadius: 4, background: "var(--border)" }}>
            <span style={{ display: "block", height: "100%", width: `${(b.value / max) * 100}%`, borderRadius: 4, background: "var(--accent)" }} />
          </span>
          <span style={{ textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>{b.caption}</span>
        </div>
      ))}
    </div>
  );
}

function Tag({ tag }: { tag?: LoyaltyTag }) {
  if (!tag) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: TAG_COLOR[tag] }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {tag}
    </span>
  );
}

/** Обгортка пункту: ✎ у правому верхньому куті, під вмістом — коментарі й поле вводу */
function Commentable({ item, ctx, style, children }: { item: LoyaltyItem; ctx: Ctx; style: React.CSSProperties; children: ReactNode }) {
  const comments = ctx.byItem.get(item.key) ?? [];
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = () => { setDraft(""); setComposing((v) => !v || editId !== null); setEditId(null); };
  const openEdit = (c: Comment) => { setEditId(c.id); setDraft(c.body); setComposing(true); };
  const close = () => { setComposing(false); setEditId(null); setDraft(""); };

  const save = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = editId
      ? await ctx.supabase.from("loyalty_comments").update({ body }).eq("id", editId)
      : await ctx.supabase.from("loyalty_comments").insert({ item_key: item.key, body });
    setBusy(false);
    if (error) { alert("Не вдалося зберегти: " + error.message); return; }
    close();
    await ctx.onChanged();
  };

  const remove = async (c: Comment) => {
    if (!confirm("Видалити коментар?")) return;
    const { error } = await ctx.supabase.from("loyalty_comments").delete().eq("id", c.id);
    if (error) { alert("Не вдалося видалити: " + error.message); return; }
    if (editId === c.id) close();
    await ctx.onChanged();
  };

  const on = composing && !editId;
  return (
    <div style={{ ...style, position: "relative", paddingRight: 44 }}>
      <button type="button" className={s.iconBtn} onClick={openNew}
        aria-label={`Коментар до «${item.title}»`} title="Додати коментар" aria-expanded={on}
        style={{ position: "absolute", top: style === tile ? 10 : 8, right: style === tile ? 10 : 0, width: 28, height: 28,
          ...(on ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }}>
        <PencilIcon />
        {comments.length > 0 && (
          <span style={{ position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 10, lineHeight: "16px" }}>
            {comments.length}
          </span>
        )}
      </button>
      {children}

      {comments.length > 0 && (
        <ul style={{ listStyle: "none", margin: "6px -34px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map((c) => (
            <li key={c.id} style={{ borderLeft: "2px solid var(--accent)", padding: "4px 0 4px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <span style={{ flex: 1, minWidth: 0 }}>{who(c.author_email)} · {when(c.created_at)}{c.updated_at !== c.created_at && " · змінено"}</span>
                {c.author_id === ctx.uid && (
                  <>
                    <button type="button" className={s.iconBtn} style={{ width: 22, height: 22 }} onClick={() => openEdit(c)} aria-label="Редагувати коментар" title="Редагувати"><PencilIcon size={11} /></button>
                    <button type="button" className={`${s.iconBtn} ${s.iconBtnDanger}`} style={{ width: 22, height: 22 }} onClick={() => remove(c)} aria-label="Видалити коментар" title="Видалити"><TrashIcon /></button>
                  </>
                )}
              </div>
              <div style={{ marginTop: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.45 }}>{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <div style={{ marginTop: 8, marginRight: -34, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea className={s.input} rows={3} autoFocus maxLength={MAX} value={draft}
            placeholder="Коментар: рішення, питання, цифри…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
            style={{ resize: "vertical", lineHeight: 1.5, maxWidth: "100%", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
