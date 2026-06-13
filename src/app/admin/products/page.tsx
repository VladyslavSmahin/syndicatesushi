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
const SET_SLUG = "сети";
const ROLL_SLUG = "роли";

interface Draft {
  categoryId: string; subcategoryId: string;
  name: string; price: number; weight: string; pieces: string; badge: Badge;
  desc: string; composition: string; fullDesc: string; photo: string | null; isAvailable: boolean;
  ingredientIds: string[]; ingredientGrams: Record<string, number>; setItemIds: string[];
}

const emptyDraft = (categoryId: string): Draft => ({
  categoryId, subcategoryId: "", name: "", price: 0, weight: "", pieces: "", badge: "",
  desc: "", composition: "", fullDesc: "", photo: null, isAvailable: true,
  ingredientIds: [], ingredientGrams: {}, setItemIds: [],
});

const toInput = (d: Draft): ProductInput => ({
  categoryId: d.categoryId || null, subcategoryId: d.subcategoryId || null,
  name: d.name.trim(), price: d.price, weight: d.weight, pieces: d.pieces, badge: d.badge,
  desc: d.desc, composition: d.composition, fullDesc: d.fullDesc, photo: d.photo, isAvailable: d.isAvailable,
  ingredientIds: d.ingredientIds, ingredientGrams: d.ingredientGrams, setItemIds: d.setItemIds,
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
  const [setPick, setSetPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState<string>("all"); // id категорії | "all" | "__none__"
  const [query, setQuery] = useState("");

  const active = useMemo(() => products.filter((p) => !p.deletedAt), [products]);
  const setyCat = useMemo(() => categories.find((c) => c.slug === SET_SLUG), [categories]);
  const roliCat = useMemo(() => categories.find((c) => c.slug === ROLL_SLUG), [categories]);

  const draftSubs = useMemo(
    () => (draft ? subcategories.filter((sc) => sc.categoryId === draft.categoryId) : []),
    [subcategories, draft]
  );
  const ingById = useMemo(() => new Map(ingredients.map((i) => [i.id, i] as const)), [ingredients]);
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);
  const portion = draft ? computePortion(draft.ingredientGrams, ingById) : null;

  const isSetDraft = !!draft && !!setyCat && draft.categoryId === setyCat.id;
  // доступні роли для складу сету (категорія «Роли», не сам редагований сет)
  const rollOptions = useMemo(
    () => active.filter((p) => roliCat && p.categoryId === roliCat.id && p.id !== editing?.id)
      .sort((a, b) => a.name.localeCompare(b.name, "uk")),
    [active, roliCat, editing]
  );

  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? "";
  const prodName = (id: string) => prodById.get(id)?.name ?? "—";

  // фільтр за категорією + пошук + групування
  const filtered = useMemo(() => {
    let list = active;
    if (catFilter === "__none__") list = list.filter((p) => !p.categoryId);
    else if (catFilter !== "all") list = list.filter((p) => p.categoryId === catFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.composition.toLowerCase().includes(q) ||
        p.setItemIds.some((id) => prodById.get(id)?.name.toLowerCase().includes(q)) ||
        p.ingredientIds.some((id) => ingredients.find((i) => i.id === id)?.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [active, catFilter, query, prodById, ingredients]);
  const groups = useMemo(() => {
    const gs = categories
      .map((c) => ({ id: c.id, name: c.name, items: filtered.filter((p) => p.categoryId === c.id) }))
      .filter((g) => g.items.length);
    const noCat = filtered.filter((p) => !p.categoryId);
    if (noCat.length) gs.push({ id: "__none__", name: "Без категорії", items: noCat });
    return gs;
  }, [categories, filtered]);

  const openNew = () => {
    setEditing(null);
    const cat = catFilter !== "all" && catFilter !== "__none__" ? catFilter : categories[0]?.id ?? "";
    setDraft(emptyDraft(cat));
  };
  const openEdit = (p: DbProduct) => {
    setEditing(p);
    setDraft({
      categoryId: p.categoryId ?? "", subcategoryId: p.subcategoryId ?? "",
      name: p.name, price: p.price, weight: p.weight, pieces: p.pieces, badge: p.badge,
      desc: p.desc, composition: p.composition, fullDesc: p.fullDesc, photo: p.photo, isAvailable: p.isAvailable,
      ingredientIds: [...p.ingredientIds], ingredientGrams: { ...p.ingredientGrams }, setItemIds: [...p.setItemIds],
    });
  };
  const close = () => { setDraft(null); setEditing(null); setNewIng(""); setSetPick(""); };

  // «Склад» формується автоматично з обраних інгредієнтів (для сетів — з ролів)
  const compositionAuto = !draft
    ? ""
    : (setyCat && draft.categoryId === setyCat.id)
      ? draft.setItemIds.map((id) => prodById.get(id)?.name ?? "").filter(Boolean).join(", ")
      : draft.ingredientIds.map((id) => ingName(id)).filter(Boolean).join(", ").toLowerCase();

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    const input = { ...toInput(draft), composition: compositionAuto };
    const err = editing ? await dbUpdateProduct(editing.id, input) : await dbCreateProduct(input);
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

  const addSetItem = (id: string) => setDraft((d) => (d && id && !d.setItemIds.includes(id) ? { ...d, setItemIds: [...d.setItemIds, id] } : d));
  const removeSetItem = (id: string) => setDraft((d) => (d ? { ...d, setItemIds: d.setItemIds.filter((x) => x !== id) } : d));
  const addPickedRoll = () => {
    const r = rollOptions.find((o) => o.name === setPick.trim());
    if (r) { addSetItem(r.id); setSetPick(""); }
  };
  const setItemsTotal = draft ? draft.setItemIds.reduce((sum, id) => sum + (prodById.get(id)?.price ?? 0), 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Товари згруповані за категоріями. Для сетів (категорія «Сети») склад задається ролами,
        для решти — інгредієнтами (за ними працює фільтр на сайті).
      </p>

      <BulkPriceTool products={active} ingredients={ingredients} categories={categories} subcategories={subcategories} onApplied={refetch} />

      {/* фільтр за категорією */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className={`chip square ${catFilter === "all" ? "active" : ""}`} onClick={() => setCatFilter("all")}>
          Усі ({active.length})
        </button>
        {categories.map((c) => {
          const n = active.filter((p) => p.categoryId === c.id).length;
          if (!n) return null;
          return (
            <button key={c.id} className={`chip square ${catFilter === c.id ? "active" : ""}`} onClick={() => setCatFilter(c.id)}>
              {c.name} ({n})
            </button>
          );
        })}
      </div>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Товари ({filtered.length})</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 1 280px" }}>
              <input className={s.input} placeholder="Пошук за назвою / складом…" value={query}
                onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", paddingRight: query ? 30 : undefined }} />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Очистити"
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              )}
            </div>
            <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew} disabled={!categories.length}>+ Товар</button>
          </div>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Назва</th><th>Ціна</th><th>Склад</th><th>Бейдж</th><th>В наявності</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : groups.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Немає товарів.</td></tr>
              ) : groups.map((g) => (
                <GroupRows key={g.id} name={g.name} count={g.items.length}>
                  {g.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0, border: "1px solid var(--border)", background: p.photo ? `#0A0908 url(${p.photo}) center/cover no-repeat` : "var(--bg-elevated)" }} />
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>{p.name}</span>
                          {/* моб.: бейдж + ціна у верхньому рядку */}
                          <span className={s.cardMeta}>
                            {p.badge && <span className={`${s.pill} ${s.pillEditor}`}>{p.badge}</span>}
                            <span style={{ fontWeight: 700 }}>{p.price} грн</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Ціна" className={s.colHideMobile}>{p.price} грн</td>
                      <td className={s.composCell} style={{ color: "var(--text-secondary)", fontSize: 11, maxWidth: 320 }}>
                        {p.setItemIds.length
                          ? `🍱 ${p.setItemIds.map(prodName).join(", ")}`
                          : p.ingredientIds.length ? p.ingredientIds.map(ingName).filter(Boolean).join(", ") : "—"}
                      </td>
                      <td data-label="Бейдж" className={s.colHideMobile}>{p.badge ? <span className={`${s.pill} ${s.pillEditor}`}>{p.badge}</span> : "—"}</td>
                      <td data-label="В наявності">
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
                </GroupRows>
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
              {!isSetDraft && draftSubs.length > 0 && (
                <Field label="Підкатегорія" grow>
                  <select className={s.input} value={draft.subcategoryId} onChange={(e) => set("subcategoryId", e.target.value)}>
                    <option value="">— Без підкатегорії —</option>
                    {draftSubs.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Ціна, грн">
                <input className={`${s.input} no-spin`} type="number" value={draft.price || ""} onChange={(e) => set("price", e.target.value === "" ? 0 : Number(e.target.value))} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Вага, гр" grow>
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

            {isSetDraft ? (
              <Field label="Ролы в сеті">
                <div style={{ display: "flex", gap: 8 }}>
                  <input className={s.input} list="roll-options" placeholder="Почніть вводити рол…"
                    value={setPick} onChange={(e) => setSetPick(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPickedRoll(); } }} />
                  <datalist id="roll-options">
                    {rollOptions.filter((r) => !draft.setItemIds.includes(r.id)).map((r) => <option key={r.id} value={r.name} />)}
                  </datalist>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={addPickedRoll}
                    disabled={!rollOptions.some((o) => o.name === setPick.trim())}>+ Додати</button>
                </div>

                {draft.setItemIds.length > 0 ? (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {draft.setItemIds.map((id) => (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6 }}>
                        <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{prodName(id)}</span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{prodById.get(id)?.price ?? 0} грн</span>
                        <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => removeSetItem(id)}>Прибрати</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                      Ролів у сеті: <b>{draft.setItemIds.length}</b> · сума за прайсом ролів: {setItemsTotal} грн
                    </div>
                  </div>
                ) : (
                  <p className={s.hint} style={{ fontSize: 11, marginTop: 8 }}>Додайте роли зі списку (категорія «Роли»).</p>
                )}
              </Field>
            ) : (
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
                          value={draft.ingredientGrams[id] || ""} onChange={(e) => setGram(id, e.target.value)} />
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
            )}

            <Field label="Короткий опис (на картці)">
              <input className={s.input} value={draft.desc} onChange={(e) => set("desc", e.target.value)} />
            </Field>
            <Field label="Склад">
              <input className={s.input} value={compositionAuto} readOnly disabled style={{ opacity: 0.7 }}
                placeholder={isSetDraft ? "Додайте роли вище" : "Оберіть інгредієнти вище"} />
              <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>
                Підтягується автоматично з обраних {isSetDraft ? "ролів" : "інгредієнтів"}.
              </span>
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

function GroupRows({ name, count, children }: { name: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={6} style={{ background: "var(--bg-elevated)", padding: "8px 14px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: 0.5, color: "var(--accent)", borderTop: "1px solid var(--border-light)" }}>
          {name} <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>· {count}</span>
        </td>
      </tr>
      {children}
    </>
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
