"use client";

import { useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useProducts, productsStore, type AdminProduct,
  useIngredients, ingredientsStore,
} from "@/features/admin/stores";
import { useCategories } from "@/features/admin/categoriesStore";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import type { Badge } from "@/lib/types";
import s from "@/components/admin/admin.module.css";

const BADGES: Badge[] = ["", "ХІТ", "НОВЕ"];

type Draft = Omit<AdminProduct, "id">;

const emptyDraft = (category: string): Draft => ({
  name: "", category, price: 0, weight: "", pieces: "", badge: "",
  isHit: false, desc: "", composition: "", ingredientIds: [], fullDesc: "", photo: null, isAvailable: true,
});

export default function ProductsPage() {
  const products = useProducts();
  const cats = useCategories();
  const ingredients = useIngredients();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newIng, setNewIng] = useState("");

  const catName = (slug: string) => cats.find((c) => c.slug === slug)?.name ?? slug;
  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? "";

  const openNew = () => { setEditing(null); setDraft(emptyDraft(cats[0]?.slug ?? "")); };
  const openEdit = (p: AdminProduct) => { setEditing(p); const { id: _id, ...rest } = p; void _id; setDraft(rest); };
  const close = () => { setDraft(null); setEditing(null); setNewIng(""); };

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    if (editing) productsStore.update(editing.id, draft);
    else productsStore.add(draft);
    close();
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const handlePhotoFile = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Файл завеликий (макс. 2 МБ для демо). На проді — Supabase Storage без таких обмежень.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("photo", typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const toggleIng = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const has = d.ingredientIds.includes(id);
      return { ...d, ingredientIds: has ? d.ingredientIds.filter((x) => x !== id) : [...d.ingredientIds, id] };
    });

  const addNewIngredient = () => {
    const n = newIng.trim();
    if (!n) return;
    const exists = ingredients.find((i) => i.name.toLowerCase() === n.toLowerCase());
    const ing = exists ?? ingredientsStore.add({ name: n });
    setDraft((d) => (d && !d.ingredientIds.includes(ing.id) ? { ...d, ingredientIds: [...d.ingredientIds, ing.id] } : d));
    setNewIng("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Товари. Інгредієнти призначаються як окремі сутності (не текст) — саме за ними
        працює фільтр на сайті. «Склад» — окреме описове поле для відображення.
      </p>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Товари ({products.length})</div>
          <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew}>+ Товар</button>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Інгредієнти</th><th>Бейдж</th><th>В наявності</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0, border: "1px solid var(--border)", background: p.photo ? `#0A0908 url(${p.photo}) center/cover no-repeat` : "var(--bg-elevated)" }} />
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{catName(p.category)}</td>
                  <td>{p.price} грн</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {p.ingredientIds.length ? p.ingredientIds.map(ingName).filter(Boolean).join(", ") : "—"}
                  </td>
                  <td>{p.badge ? <span className={`${s.pill} ${s.pillEditor}`}>{p.badge}</span> : "—"}</td>
                  <td>
                    <button className={`${s.pill} ${p.isAvailable ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => productsStore.update(p.id, { isAvailable: !p.isAvailable })}>
                      {p.isAvailable ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(p)}>Редагувати</button>
                      {isAdmin && (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => productsStore.remove(p.id)}>Видалити</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {draft && (
        <Modal
          title={editing ? "Редагувати товар" : "Новий товар"}
          onClose={close}
          footer={
            <>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={close}>Скасувати</button>
              <button className={s.btn} onClick={save} disabled={!draft.name.trim()}>Зберегти</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Фото товару */}
            <Field label="Фото товару">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div
                  style={{
                    width: 96, height: 96, flexShrink: 0, borderRadius: 8, overflow: "hidden",
                    border: "1px solid var(--border-light)",
                    background: draft.photo ? `#0A0908 url(${draft.photo}) center/cover no-repeat` : "var(--bg-elevated)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 10,
                  }}
                >
                  {!draft.photo && "Немає"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ cursor: "pointer", textAlign: "center" }}>
                    {draft.photo ? "Замінити" : "Завантажити"}
                    <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                  </label>
                  {draft.photo && (
                    <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => set("photo", null)}>
                      Прибрати
                    </button>
                  )}
                </div>
              </div>
              <p className={s.hint} style={{ fontSize: 11, marginTop: 8 }}>
                Демо: фото зберігається локально (data URL). На проді — завантаження в Supabase Storage.
              </p>
            </Field>

            <Field label="Назва">
              <input className={s.input} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Категорія" grow>
                <select className={s.input} value={draft.category} onChange={(e) => set("category", e.target.value)}>
                  {cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Ціна, грн">
                <input className={s.input} type="number" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Вага" grow>
                <input className={s.input} placeholder="290 г" value={draft.weight} onChange={(e) => set("weight", e.target.value)} />
              </Field>
              <Field label="Кількість" grow>
                <input className={s.input} placeholder="8 шт" value={draft.pieces} onChange={(e) => set("pieces", e.target.value)} />
              </Field>
              <Field label="Бейдж">
                <select className={s.input} value={draft.badge} onChange={(e) => set("badge", e.target.value as Badge)}>
                  {BADGES.map((b) => <option key={b} value={b}>{b || "—"}</option>)}
                </select>
              </Field>
            </div>

            {/* Інгредієнти як сутності — для фільтра */}
            <Field label="Інгредієнти (для фільтра)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {ingredients.map((ing) => {
                  const active = draft.ingredientIds.includes(ing.id);
                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => toggleIng(ing.id)}
                      className={`chip ${active ? "active" : ""}`}
                    >
                      {ing.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className={s.input}
                  placeholder="Новий інгредієнт…"
                  value={newIng}
                  onChange={(e) => setNewIng(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewIngredient(); } }}
                />
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={addNewIngredient} disabled={!newIng.trim()}>
                  + Додати
                </button>
              </div>
            </Field>

            <Field label="Короткий опис (на картці)">
              <input className={s.input} value={draft.desc} onChange={(e) => set("desc", e.target.value)} />
            </Field>
            <Field label="Склад (описовий текст)">
              <input className={s.input} value={draft.composition} onChange={(e) => set("composition", e.target.value)} />
            </Field>
            <Field label="Повний опис">
              <textarea className={s.input} style={{ minHeight: 70, resize: "vertical" }} value={draft.fullDesc} onChange={(e) => set("fullDesc", e.target.value)} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.isHit} onChange={(e) => set("isHit", e.target.checked)} />
              Показувати у блоці «Хіти меню»
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={s.field} style={grow ? { flex: 1, minWidth: 160 } : undefined}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}
