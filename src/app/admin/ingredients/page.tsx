"use client";

import { useEffect, useState } from "react";
import {
  useDbIngredients, dbCreateIngredient, dbUpdateIngredient, dbDeleteIngredient,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

type NutField = "kcal" | "protein" | "fat" | "carbs";
const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function IngredientsPage() {
  const { ingredients, loading, refetch } = useDbIngredients();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [draft, setDraft] = useState({ name: "", kcal: "", protein: "", fat: "", carbs: "" });
  const [error, setError] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = draft.name.trim();
    if (!n) return;
    if (ingredients.some((i) => i.name.toLowerCase() === n.toLowerCase())) { setError("Такий інгредієнт вже є"); return; }
    const created = await dbCreateIngredient(n, { kcal: num(draft.kcal), protein: num(draft.protein), fat: num(draft.fat), carbs: num(draft.carbs) });
    if (!created) { setError("Не вдалося додати (можливо, дублікат назви)"); return; }
    setDraft({ name: "", kcal: "", protein: "", fat: "", carbs: "" });
    setError("");
    refetch();
  };

  const setNut = async (id: string, field: NutField, value: number | null) => {
    await dbUpdateIngredient(id, { [field]: value });
    refetch();
  };
  const remove = async (id: string) => {
    if (confirm("Видалити інгредієнт? Він прибереться з усіх товарів.")) { await dbDeleteIngredient(id); refetch(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Інгредієнти — окрема сутність для фільтрації каталогу. КБЖУ вказується <b>на 100 г</b>
        (можна редагувати прямо в таблиці, зберігається при розфокусі).
      </p>

      <form className={s.card} onSubmit={add}>
        <div className={s.cardHead}><div className={s.cardTitle}>Новий інгредієнт</div></div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow} style={{ alignItems: "flex-end" }}>
            <div className={s.field} style={{ flex: 1, minWidth: 200 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input className={s.input} placeholder="Напр. Манго" value={draft.name}
                onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setError(""); }} />
            </div>
            {(["kcal", "protein", "fat", "carbs"] as NutField[]).map((f) => (
              <div key={f} className={s.field} style={{ width: 92 }}>
                <span className={s.fieldLabel}>{NUT_LABEL[f]}</span>
                <input className={`${s.input} no-spin`} type="number" step="0.1" min="0" placeholder="—" value={draft[f]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />
              </div>
            ))}
            <button className={s.btn} type="submit" disabled={!draft.name.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Інгредієнти ({ingredients.length})</div></div>
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.nutTable}`}>
            <thead>
              <tr><th>Назва</th><th>Ккал</th><th>Білки, г</th><th>Жири, г</th><th>Вугл., г</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{ing.name}</td>
                  {(["kcal", "protein", "fat", "carbs"] as NutField[]).map((f) => (
                    <td key={f} className={s.nutCell} data-label={NUT_LABEL[f]}>
                      <NutCell value={ing[f]} onCommit={(v) => setNut(ing.id, f, v)} />
                    </td>
                  ))}
                  <td>
                    <div className={s.rowActions}>
                      {isAdmin ? (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(ing.id)}>Видалити</button>
                      ) : <span className={s.hint} style={{ fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const NUT_LABEL: Record<NutField, string> = { kcal: "Ккал", protein: "Білки", fat: "Жири", carbs: "Вугл." };

// Інпут КБЖУ: локальний стан під час набору, запис у БД при розфокусі (blur).
function NutCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [local, setLocal] = useState<string>(value != null ? String(value) : "");
  useEffect(() => { setLocal(value != null ? String(value) : ""); }, [value]);
  const commit = () => {
    const next = local.trim() === "" ? null : Number(local);
    if (next !== value) onCommit(next);
  };
  return (
    <input
      className={`${s.input} no-spin`}
      type="number" step="0.1" min="0" placeholder="—"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ width: 78, padding: "8px 10px" }}
    />
  );
}
