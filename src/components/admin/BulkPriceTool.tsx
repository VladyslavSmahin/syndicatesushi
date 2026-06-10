"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useProducts, productsStore, useIngredients } from "@/features/admin/stores";
import { logPriceChange } from "@/features/admin/priceHistory";
import s from "./admin.module.css";

type Mode = "amount" | "percent";

interface Row {
  id: string;
  name: string;
  oldPrice: number;
  newPrice: number;
}

export default function BulkPriceTool() {
  const products = useProducts();
  const ingredients = useIngredients();

  const [ingId, setIngId] = useState(ingredients[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("amount");
  const [value, setValue] = useState(10);
  const [rows, setRows] = useState<Row[] | null>(null);

  const calcNew = (old: number) => {
    const raw = mode === "amount" ? old + value : old * (1 + value / 100);
    return Math.max(0, Math.round(raw));
  };

  const preview = () => {
    if (!ingId) return;
    const affected = products
      .filter((p) => p.ingredientIds.includes(ingId))
      .map((p) => ({ id: p.id, name: p.name, oldPrice: p.price, newPrice: calcNew(p.price) }));
    setRows(affected);
  };

  const nudge = (id: string, delta: number) =>
    setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, newPrice: Math.max(0, r.newPrice + delta) } : r)));

  const setRowPrice = (id: string, v: number) =>
    setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, newPrice: Math.max(0, v) } : r)));

  const removeRow = (id: string) => setRows((rs) => rs!.filter((r) => r.id !== id));

  const apply = () => {
    const changed = rows!.filter((r) => r.newPrice !== r.oldPrice);
    changed.forEach((r) => productsStore.update(r.id, { price: r.newPrice }));
    const sign = value >= 0 ? "+" : "";
    const label = `${ingName} ${sign}${value}${mode === "amount" ? " грн" : "%"}`;
    logPriceChange("bulk", label, changed.map((r) => ({ productId: r.id, name: r.name, from: r.oldPrice, to: r.newPrice })));
    setRows(null);
  };

  const ingName = ingredients.find((i) => i.id === ingId)?.name ?? "";

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardTitle}>Масова зміна цін за інгредієнтом</div>
      </div>
      <div style={{ padding: 22 }}>
        <p className={s.hint} style={{ marginBottom: 16 }}>
          Підніме (або знизить) ціну всіх товарів із обраним інгредієнтом. Перед застосуванням
          побачите список зі старими й новими цінами — можна підкоригувати або прибрати товар.
        </p>
        <div className={s.formRow}>
          <div className={s.field} style={{ flex: 1, minWidth: 180 }}>
            <span className={s.fieldLabel}>Інгредієнт</span>
            <select className={s.input} value={ingId} onChange={(e) => setIngId(e.target.value)}>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
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
            <input className={s.input} type="number" style={{ width: 120 }} value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </div>
          <button className={s.btn} onClick={preview} disabled={!ingId}>Переглянути</button>
        </div>
      </div>

      {rows && (
        <Modal
          title={`Зміна цін: ${ingName} (${mode === "amount" ? (value >= 0 ? "+" : "") + value + " грн" : (value >= 0 ? "+" : "") + value + "%"})`}
          onClose={() => setRows(null)}
          footer={
            <>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setRows(null)}>Скасувати</button>
              <button className={s.btn} onClick={apply} disabled={rows.length === 0}>
                Застосувати ({rows.length})
              </button>
            </>
          }
        >
          {rows.length === 0 ? (
            <p className={s.hint}>Немає товарів із цим інгредієнтом (або всі прибрані).</p>
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
                          <input
                            className={s.input}
                            type="number"
                            style={{ width: 84, padding: "7px 8px", textAlign: "center" }}
                            value={r.newPrice}
                            onChange={(e) => setRowPrice(r.id, Number(e.target.value))}
                          />
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
