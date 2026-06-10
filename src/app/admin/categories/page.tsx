"use client";

import { useState } from "react";
import { categoriesStore, useCategories } from "@/features/admin/categoriesStore";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

export default function CategoriesPage() {
  const cats = useCategories();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const slug = n.toLowerCase().replace(/\s+/g, "-");
    if (cats.some((c) => c.slug === slug)) {
      setError("Категорія з такою назвою вже існує");
      return;
    }
    const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    categoriesStore.add({ name: n, slug, sortOrder: maxOrder + 10, showInNav: true, isActive: true });
    setName("");
    setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Категорії одразу зʼявляються в навігації сайту (у шапці та бургер-меню).
        Вимкніть «У навігації» або «Активна», щоб приховати без видалення.
      </p>

      {/* Add form */}
      <form className={s.card} onSubmit={handleAdd}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Нова категорія</div>
        </div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ flex: 1, minWidth: 220 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input
                className={s.input}
                placeholder="Напр. Десерти"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
              />
            </div>
            <button className={s.btn} type="submit" disabled={!name.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      {/* Table */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Категорії ({cats.length})</div>
          {isAdmin && (
            <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => categoriesStore.reset()}>
              Скинути до типових
            </button>
          )}
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Назва</th>
                <th>Slug</th>
                <th>Порядок</th>
                <th>У навігації</th>
                <th>Активна</th>
                <th style={{ textAlign: "right" }}>Дії</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{c.slug}</td>
                  <td>{c.sortOrder}</td>
                  <td>
                    <button
                      className={`${s.pill} ${c.showInNav ? s.pillOn : s.pillOff}`}
                      style={{ cursor: "pointer", border: "none" }}
                      onClick={() => categoriesStore.update(c.id, { showInNav: !c.showInNav })}
                    >
                      {c.showInNav ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`${s.pill} ${c.isActive ? s.pillOn : s.pillOff}`}
                      style={{ cursor: "pointer", border: "none" }}
                      onClick={() => categoriesStore.update(c.id, { isActive: !c.isActive })}
                    >
                      {c.isActive ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      {isAdmin ? (
                        <button
                          className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          onClick={() => categoriesStore.remove(c.id)}
                        >
                          Видалити
                        </button>
                      ) : (
                        <span className={s.hint} style={{ fontSize: 11 }}>—</span>
                      )}
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
