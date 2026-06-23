"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/admin/Modal";
import { computePortion } from "@/features/nutrition";
import type { DbProduct, DbCategory, DbSubcategory, DbIngredient } from "@/features/admin/db";
import type { CatalogData, PdfCategory } from "@/features/admin/catalogPdf";
import s from "@/components/admin/admin.module.css";

export default function CatalogDownloadModal({
  products, categories, subcategories, ingredients, onClose,
}: {
  products: DbProduct[]; categories: DbCategory[]; subcategories: DbSubcategory[];
  ingredients: DbIngredient[]; onClose: () => void;
}) {
  const active = useMemo(() => products.filter((p) => !p.deletedAt), [products]);
  // категорії з товарами (у порядку sortOrder як у categories)
  const catsWithItems = useMemo(
    () => categories.filter((c) => active.some((p) => p.categoryId === c.id)),
    [categories, active]
  );
  const [picked, setPicked] = useState<Set<string>>(() => new Set(catsWithItems.map((c) => c.id)));
  const [showPrice, setShowPrice] = useState(true);
  const [showNutrition, setShowNutrition] = useState(true);
  const [showDesc, setShowDesc] = useState(true);
  const [showIngredients, setShowIngredients] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ingById = useMemo(() => new Map(ingredients.map((i) => [i.id, i] as const)), [ingredients]);
  const prodById = useMemo(() => new Map(active.map((p) => [p.id, p] as const)), [active]);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const allOn = picked.size === catsWithItems.length;
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(catsWithItems.map((c) => c.id)));

  // вага + КБЖУ порції (для сета — сума ролів)
  const portionOf = (p: DbProduct) => {
    if (p.setItemIds.length) {
      let weight = 0, kcal = 0, protein = 0, fat = 0, carbs = 0;
      for (const id of p.setItemIds) {
        const r = prodById.get(id); if (!r) continue;
        const po = computePortion(r.ingredientGrams, ingById);
        weight += po.weight; kcal += po.kcal; protein += po.protein; fat += po.fat; carbs += po.carbs;
      }
      return { weight: Math.round(weight * 10) / 10, kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10, fat: Math.round(fat * 10) / 10, carbs: Math.round(carbs * 10) / 10 };
    }
    return computePortion(p.ingredientGrams, ingById);
  };
  const compositionOf = (p: DbProduct) => {
    if (p.setItemIds.length) return p.setItemIds.map((id) => prodById.get(id)?.name).filter(Boolean).join(" · ");
    return p.ingredientIds
      .map((id) => { const ing = ingById.get(id); if (!ing) return ""; const g = p.ingredientGrams[id]; return g ? `${ing.name} ${g} г` : ing.name; })
      .filter(Boolean).join(" · ");
  };

  const buildData = (): CatalogData => {
    const cats: PdfCategory[] = [];
    for (const c of catsWithItems) {
      if (!picked.has(c.id)) continue;
      const items = active.filter((p) => p.categoryId === c.id);
      const subs = subcategories.filter((sc) => sc.categoryId === c.id).sort((a, b) => a.sortOrder - b.sortOrder);
      const subgroups = [] as PdfCategory["subgroups"];
      const toPdf = (list: DbProduct[]) =>
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "uk"))
          .map((p) => {
            const po = portionOf(p);
            const weight = p.weight.trim() || (po.weight > 0 ? `${po.weight} г` : "");
            return {
              name: p.name, price: p.price, weight, pieces: p.pieces.trim(),
              kcal: po.kcal, protein: po.protein, fat: po.fat, carbs: po.carbs,
              desc: p.desc.trim(), composition: compositionOf(p), available: p.isAvailable,
            };
          });
      for (const sc of subs) {
        const list = items.filter((p) => p.subcategoryId === sc.id);
        if (list.length) subgroups.push({ name: sc.name, products: toPdf(list) });
      }
      const noSub = items.filter((p) => !p.subcategoryId);
      if (noSub.length) subgroups.push({ name: subs.length ? "Інше" : null, products: toPdf(noSub) });
      cats.push({ name: c.name, subgroups });
    }
    const ingList = showIngredients
      ? ingredients.slice().sort((a, b) => a.name.localeCompare(b.name, "uk"))
        .map((i) => ({ name: i.name, kcal: i.kcal, protein: i.protein, fat: i.fat, carbs: i.carbs }))
      : null;
    return {
      title: "Каталог продукції — Syndicate Sushi",
      date: new Date().toLocaleDateString("uk-UA"),
      show: { price: showPrice, nutrition: showNutrition, descComposition: showDesc },
      categories: cats, ingredients: ingList,
    };
  };

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const { generateCatalogBlob } = await import("@/features/admin/catalogPdf");
      const blob = await generateCatalogBlob(buildData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `katalog-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося згенерувати PDF");
      setBusy(false);
    }
  };

  const cb = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <Modal
      title="Завантажити каталог (PDF)"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onClose} disabled={busy}>Скасувати</button>
          <button className={s.btn} onClick={generate} disabled={busy || picked.size === 0}>
            {busy ? "Генерація…" : "Згенерувати PDF"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className={s.fieldLabel}>Категорії</span>
            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={toggleAll}>
              {allOn ? "Зняти всі" : "Обрати всі"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {catsWithItems.map((c) => {
              const cnt = active.filter((p) => p.categoryId === c.id).length;
              return (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.name} <span style={{ color: "var(--text-secondary)" }}>({cnt})</span></span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border, #e2e2e2)", paddingTop: 14 }}>
          <span className={s.fieldLabel} style={{ display: "block", marginBottom: 8 }}>Що показувати</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cb(showPrice, setShowPrice, "Ціна")}
            {cb(showNutrition, setShowNutrition, "КБЖУ порції")}
            {cb(showDesc, setShowDesc, "Опис і склад (грамовка)")}
            {cb(showIngredients, setShowIngredients, "Окрема сторінка «Інгредієнти» (КБЖУ на 100 г)")}
          </div>
          <p className={s.hint} style={{ fontSize: 11, marginTop: 10 }}>
            Вага й кількість шт показуються завжди. У каталог потрапляють усі товари (зокрема приховані).
          </p>
          {err && <p style={{ color: "var(--danger, #b8002e)", fontSize: 12, marginTop: 8 }}>{err}</p>}
        </div>
      </div>
    </Modal>
  );
}
