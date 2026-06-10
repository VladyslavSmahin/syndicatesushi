"use client";

import { useState } from "react";
import { useIngredients, ingredientsStore, useProducts, productsStore } from "@/features/admin/stores";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

export default function IngredientsPage() {
  const ingredients = useIngredients();
  const products = useProducts();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const countFor = (id: string) =>
    products.filter((p) => p.ingredientIds.includes(id)).length;

  const removeIngredient = (id: string) => {
    // прибираємо інгредієнт і чистимо посилання у товарах
    products.forEach((p) => {
      if (p.ingredientIds.includes(id)) {
        productsStore.update(p.id, { ingredientIds: p.ingredientIds.filter((x) => x !== id) });
      }
    });
    ingredientsStore.remove(id);
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (ingredients.some((i) => i.name.toLowerCase() === n.toLowerCase())) {
      setError("Такий інгредієнт вже є");
      return;
    }
    ingredientsStore.add({ name: n });
    setName("");
    setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Інгредієнти — окрема сутність для фільтрації каталогу по складу.
      </p>

      <form className={s.card} onSubmit={add}>
        <div className={s.cardHead}><div className={s.cardTitle}>Новий інгредієнт</div></div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ flex: 1, minWidth: 220 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input className={s.input} placeholder="Напр. Манго" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
            </div>
            <button className={s.btn} type="submit" disabled={!name.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Інгредієнти ({ingredients.length})</div></div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Назва</th><th>Згадок у складі</th><th style={{ textAlign: "right" }}>Дії</th></tr></thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{ing.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{countFor(ing.id)}</td>
                  <td>
                    <div className={s.rowActions}>
                      {isAdmin ? (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => removeIngredient(ing.id)}>Видалити</button>
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
