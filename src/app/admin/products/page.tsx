"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/admin/Modal";
import { computePortion } from "@/features/nutrition";
import {
  useDbProducts, useDbIngredients, useDbCategories, useDbSubcategories,
  dbCreateProduct, dbUpdateProduct, dbSetAvailable, dbSoftDelete, dbCreateIngredient,
  type DbProduct, type ProductInput,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import BulkPriceTool from "@/components/admin/BulkPriceTool";
import { dbLogPriceChange } from "@/features/admin/priceHistory";
import type { Badge } from "@/lib/types";
import s from "@/components/admin/admin.module.css";

const BADGES: Badge[] = ["", "ХІТ", "НОВЕ"];

interface Draft {
  categoryId: string; subcategoryId: string;
  name: string; price: number; weight: string; pieces: string; badge: Badge;
  desc: string; composition: string; fullDesc: string; photo: string | null; isAvailable: boolean;
  ingredientIds: string[]; ingredientGrams: Record<string, number>;
}

const emptyDraft = (categoryId: string): Draft => ({
  categoryId, subcategoryId: "", name: "", price: 0, weight: "", pieces: "", badge: "",
  desc: "", composition: "", fullDesc: "", photo: null, isAvailable: true, ingredientIds: [], ingredientGrams: {},
});

const toInput = (d: Draft): ProductInput => ({
  categoryId: d.categoryId || null, subcategoryId: d.subcategoryId || null,
  name: d.name.trim(), price: d.price, weight: d.weight, pieces: d.pieces, badge: d.badge,
  desc: d.desc, composition: d.composition, fullDesc: d.fullDesc, photo: d.photo, isAvailable: d.isAvailable,
  ingredientIds: d.ingredientIds, ingredientGrams: d.ingredientGrams,
});

export default function ProductsPage() {
  const { products, loading, refetch } = useDbProducts();
  const { ingredients, refetch: refetchIngredients } = useDbIngredients();
  const { categories } = useDbCategories();
  const { subcategories } = useDbSubcategories();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [editing, setEditing] = useState<DbProduct | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newIng, setNewIng] = useState("");
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => products.filter((p) => !p.deletedAt), [products]);
  const draftSubs = useMemo(
    () => (draft ? subcategories.filter((sc) => sc.categoryId === draft.categoryId) : []),
    [subcategories, draft]
  );
  const ingById = useMemo(() => new Map(ingredients.map((i) => [i.id, i] as const)), [ingredients]);
  const portion = draft ? computePortion(draft.ingredientGrams, ingById) : null;

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? "";

  const openNew = () => { setEditing(null); setDraft(emptyDraft(categories[0]?.id ?? "")); };
  const openEdit = (p: DbProduct) => {
    setEditing(p);
    setDraft({
      categoryId: p.categoryId ?? "", subcategoryId: p.subcategoryId ?? "",
      name: p.name, price: p.price, weight: p.weight, pieces: p.pieces, badge: p.badge,
      desc: p.desc, composition: p.composition, fullDesc: p.fullDesc, photo: p.photo, isAvailable: p.isAvailable,
      ingredientIds: [...p.ingredientIds], ingredientGrams: { ...p.ingredientGrams },
    });
  };
  const close = () => { setDraft(null); setEditing(null); setNewIng(""); };

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    const err = editing ? await dbUpdateProduct(editing.id, toInput(draft)) : await dbCreateProduct(toInput(draft));
    setSaving(false);
    if (err) { alert("Помилка збереження: " + err); return; }
    if (editing && draft.price !== editing.price) {
      await dbLogPriceChange("single", editing.name, [{ productId: editing.id, name: editing.name, from: editing.price, to: draft.price }]);
    }
    close();
    refetch();
  };

  const toggleAvailable = async (p: DbProduct) => { await dbSetAvailable(p.id, !p.isAvailable); refetch(); };
  const remove = async (p: DbProduct) => { await dbSoftDelete(p.id); refetch(); };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const handlePhotoFile = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Файл завеликий (макс. 2 МБ)."); return; }
    const reader = new FileReader();
    reader.onload = () => set("photo", typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const toggleIng = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const has = d.ingredientIds.includes(id);
      const grams = { ...d.ingredientGrams };
      if (has) delete grams[id];
      return { ...d, ingredientIds: has ? d.ingredientIds.filter((x) => x !== id) : [...d.ingredientIds, id], ingredientGrams: grams };
    });

  const setGram = (id: string, value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const grams = { ...d.ingredientGrams };
      if (value.trim() === "") delete grams[id]; else grams[id] = Number(value);
      return { ...d, ingredientGrams: grams };
    });

  const addNewIngredient = async () => {
    const n = newIng.trim();
    if (!n) return;
    const existing = ingredients.find((i) => i.name.toLowerCase() === n.toLowerCase());
    const ing = existing ?? (await dbCreateIngredient(n));
    if (!ing) { alert("Не вдалося додати інгредієнт"); return; }
    if (!existing) await refetchIngredients();
    setDraft((d) => (d && !d.ingredientIds.includes(ing.id) ? { ...d, ingredientIds: [...d.ingredientIds, ing.id] } : d));
    setNewIng("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Товари зберігаються в Supabase. Інгредієнти призначаються як окремі сутності (за ними працює
        фільтр на сайті), грамовка дає вагу та КБЖУ порції. «Склад» — описове поле.
      </p>

      <BulkPriceTool products={active} ingredients={ingredients} onApplied={refetch} />

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Товари ({active.length})</div>
          <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew} disabled={!categories.length}>+ Товар</button>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Інгредієнти</th><th>Бейдж</th><th>В наявності</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : active.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0, border: "1px solid var(--border)", background: p.photo ? `#0A0908 url(${p.photo}) center/cover no-repeat` : "var(--bg-elevated)" }} />
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{catName(p.categoryId)}</td>
                  <td>{p.price} грн</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {p.ingredientIds.length ? p.ingredientIds.map(ingName).filter(Boolean).join(", ") : "—"}
                  </td>
                  <td>{p.badge ? <span className={`${s.pill} ${s.pillEditor}`}>{p.badge}</span> : "—"}</td>
                  <td>
                    <button className={`${s.pill} ${p.isAvailable ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => toggleAvailable(p)}>
                      {p.isAvailable ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(p)}>Редагувати</button>
                      {isAdmin && (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(p)}>Видалити</button>
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
              <button className={s.btn} onClick={save} disabled={!draft.name.trim() || saving}>{saving ? "Збереження…" : "Зберегти"}</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Фото товару">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-light)", background: draft.photo ? `#0A0908 url(${draft.photo}) center/cover no-repeat` : "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 10 }}>
                  {!draft.photo && "Немає"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ cursor: "pointer", textAlign: "center" }}>
                    {draft.photo ? "Замінити" : "Завантажити"}
                    <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
                  </label>
                  {draft.photo && (
                    <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => set("photo", null)}>Прибрати</button>
                  )}
                </div>
              </div>
              <p className={s.hint} style={{ fontSize: 11, marginTop: 8 }}>
                Фото поки зберігається як data URL у БД. Окремим кроком підключимо Supabase Storage.
              </p>
            </Field>

            <Field label="Назва">
              <input className={s.input} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Категорія" grow>
                <select className={s.input} value={draft.categoryId}
                  onChange={(e) => setDraft((d) => (d ? { ...d, categoryId: e.target.value, subcategoryId: "" } : d))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {draftSubs.length > 0 && (
                <Field label="Підкатегорія" grow>
                  <select className={s.input} value={draft.subcategoryId} onChange={(e) => set("subcategoryId", e.target.value)}>
                    <option value="">— Без підкатегорії —</option>
                    {draftSubs.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Ціна, грн">
                <input className={`${s.input} no-spin`} type="number" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
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

            <Field label="Інгредієнти та грамовка">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {ingredients.map((ing) => {
                  const activeChip = draft.ingredientIds.includes(ing.id);
                  return (
                    <button key={ing.id} type="button" onClick={() => toggleIng(ing.id)} className={`chip ${activeChip ? "active" : ""}`}>
                      {ing.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className={s.input} placeholder="Новий інгредієнт…" value={newIng}
                  onChange={(e) => setNewIng(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewIngredient(); } }} />
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={addNewIngredient} disabled={!newIng.trim()}>+ Додати</button>
              </div>

              {draft.ingredientIds.length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className={s.fieldLabel}>Грамовка на порцію (г)</span>
                  {draft.ingredientIds.map((id) => (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{ingName(id)}</span>
                      <input className={`${s.input} no-spin`} type="number" min="0" step="1" placeholder="0" style={{ width: 96 }}
                        value={draft.ingredientGrams[id] ?? ""} onChange={(e) => setGram(id, e.target.value)} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 12 }}>г</span>
                    </div>
                  ))}
                  {portion && portion.weight > 0 && (
                    <div style={{ marginTop: 8, padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        Порція: <b>{portion.weight} г</b> · {portion.kcal} ккал · Б {portion.protein} · Ж {portion.fat} · В {portion.carbs}
                      </div>
                      <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => set("weight", `${portion.weight} г`)}>
                        Підставити у «Вага»
                      </button>
                    </div>
                  )}
                </div>
              )}
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
            <p className={s.hint} style={{ fontSize: 11 }}>
              Щоб товар зʼявився у блоці «Хіти меню» на сайті — встановіть бейдж «ХІТ».
            </p>
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
