"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { dbUpdatePrice, type DbProduct, type DbIngredient, type DbCategory, type DbSubcategory } from "@/features/admin/db";
import { dbLogPriceChange } from "@/features/admin/priceHistory";
import s from "./admin.module.css";

type Mode = "amount" | "percent";
type FilterType = "ingredient" | "category" | "subcategory";

interface Row { id: string; name: string; oldPrice: number; newPrice: number; }

const FILTER_LABEL: Record<FilterType, string> = {
  ingredient: "інгредієнтом", category: "категорією", subcategory: "підкатегорією",
};

export default function BulkPriceTool({
  products, ingredients, categories, subcategories, onApplied,
}: {
  products: DbProduct[];
  ingredients: DbIngredient[];
  categories: DbCategory[];
  subcategories: DbSubcategory[];
  onApplied: () => void;
}) {
  const [filterType, setFilterType] = useState<FilterType>("ingredient");
  const [targetId, setTargetId] = useState("");
  const [mode, setMode] = useState<Mode>("amount");
  const [value, setValue] = useState(10);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [applying, setApplying] = useState(false);

  const options = useMemo(() => {
    if (filterType === "ingredient") return ingredients.map((i) => ({ id: i.id, name: i.name }));
    if (filterType === "category") return categories.map((c) => ({ id: c.id, name: c.name }));
    return subcategories.map((sc) => ({ id: sc.id, name: sc.name }));
  }, [filterType, ingredients, categories, subcategories]);

  const effectiveId = targetId || options[0]?.id || "";
  const targetName = options.find((o) => o.id === effectiveId)?.name ?? "";

  const matches = (p: DbProduct) =>
    filterType === "ingredient" ? p.ingredientIds.includes(effectiveId)
      : filterType === "category" ? p.categoryId === effectiveId
        : p.subcategoryId === effectiveId;

  const calcNew = (old: number) => {
    const raw = mode === "amount" ? old + value : old * (1 + value / 100);
    return Math.max(0, Math.round(raw));
  };

  const preview = () => {
    if (!effectiveId) return;
    setRows(products.filter(matches).map((p) => ({ id: p.id, name: p.name, oldPrice: p.price, newPrice: calcNew(p.price) })));
  };

  const nudge = (id: string, delta: number) =>
    setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, newPrice: Math.max(0, r.newPrice + delta) } : r)));
  const setRowPrice = (id: string, v: number) =>
    setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, newPrice: Math.max(0, v) } : r)));
  const removeRow = (id: string) => setRows((rs) => rs!.filter((r) => r.id !== id));

  const apply = async () => {
    const changed = rows!.filter((r) => r.newPrice !== r.oldPrice);
    setApplying(true);
    await Promise.all(changed.map((r) => dbUpdatePrice(r.id, r.newPrice)));
    setApplying(false);
    const sign = value >= 0 ? "+" : "";
    await dbLogPriceChange("bulk", `${targetName} ${sign}${value}${mode === "amount" ? " грн" : "%"}`,
      changed.map((r) => ({ productId: r.id, name: r.name, from: r.oldPrice, to: r.newPrice })));
    setRows(null);
    onApplied();
  };

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardTitle}>Масова зміна цін за {FILTER_LABEL[filterType]}</div>
      </div>
      <div style={{ padding: 22 }}>
        <p className={s.hint} style={{ marginBottom: 16 }}>
          Підніме (або знизить) ціну всіх товарів обраної групи. Перед застосуванням
          побачите список зі старими й новими цінами — можна підкоригувати або прибрати товар.
        </p>
        <div className={s.formRow}>
          <div className={s.field}>
            <span className={s.fieldLabel}>Фільтр за</span>
            <select className={s.input} value={filterType}
              onChange={(e) => { setFilterType(e.target.value as FilterType); setTargetId(""); setRows(null); }}>
              <option value="ingredient">Інгредієнтом</option>
              <option value="category">Категорією</option>
              <option value="subcategory">Підкатегорією</option>
            </select>
          </div>
          <div className={s.field} style={{ flex: 1, minWidth: 180 }}>
            <span className={s.fieldLabel}>{filterType === "ingredient" ? "Інгредієнт" : filterType === "category" ? "Категорія" : "Підкатегорія"}</span>
            <select className={s.input} value={effectiveId} onChange={(e) => setTargetId(e.target.value)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>Тип</span>
            <select className={s.input} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="amount">Гривні (+/−)</option>
              <option value="percent">Відсоток (+/−)</option>
            </select>
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>{mode === "amount" ? "Сума, грн" : "Відсоток"}</span>
            <input className={`${s.input} no-spin`} type="number" style={{ width: 110 }} value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </div>
          <button className={s.btn} onClick={preview} disabled={!effectiveId}>Переглянути</button>
        </div>
      </div>

      {rows && (
        <Modal
          title={`Зміна цін: ${targetName} (${mode === "amount" ? (value >= 0 ? "+" : "") + value + " грн" : (value >= 0 ? "+" : "") + value + "%"})`}
          onClose={() => setRows(null)}
          footer={
            <>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setRows(null)}>Скасувати</button>
              <button className={s.btn} onClick={apply} disabled={rows.length === 0 || applying}>
                {applying ? "Застосування…" : `Застосувати (${rows.length})`}
              </button>
            </>
          }
        >
          {rows.length === 0 ? (
            <p className={s.hint}>Немає товарів у цій групі (або всі прибрані).</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>Товар</th><th>Стара</th><th>Нова</th><th style={{ textAlign: "right" }}>Дії</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{r.name}</td>
                      <td style={{ color: "var(--text-secondary)", textDecoration: r.newPrice !== r.oldPrice ? "line-through" : "none" }}>{r.oldPrice} грн</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ padding: "6px 10px" }} onClick={() => nudge(r.id, -5)}>−</button>
                          <input className={`${s.input} no-spin`} type="number" style={{ width: 84, padding: "7px 8px", textAlign: "center" }}
                            value={r.newPrice} onChange={(e) => setRowPrice(r.id, Number(e.target.value))} />
                          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ padding: "6px 10px" }} onClick={() => nudge(r.id, +5)}>+</button>
                          <span style={{ color: "var(--accent)", fontSize: 12 }}>
                            {r.newPrice > r.oldPrice ? `+${r.newPrice - r.oldPrice}` : r.newPrice < r.oldPrice ? `${r.newPrice - r.oldPrice}` : "—"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={s.rowActions}>
                          <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => removeRow(r.id)}>Прибрати</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
