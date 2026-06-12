"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useDbCategories, useDbSubcategories,
  dbCreateSubcategory, dbUpdateSubcategory, dbDeleteSubcategory, type DbSubcategory,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

interface SubEditDraft { id: string; name: string; categoryId: string; sortOrder: number; }

export default function SubcategoriesPage() {
  const { categories } = useDbCategories();
  const { subcategories, loading, refetch } = useDbSubcategories();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<SubEditDraft | null>(null);

  const openEdit = (sc: DbSubcategory) => setEdit({ id: sc.id, name: sc.name, categoryId: sc.categoryId, sortOrder: sc.sortOrder });
  const saveEdit = async () => {
    if (!edit || !edit.name.trim()) return;
    await dbUpdateSubcategory(edit.id, { name: edit.name.trim(), categoryId: edit.categoryId, sortOrder: edit.sortOrder });
    setEdit(null);
    refetch();
  };

  useEffect(() => { if (!categoryId && categories.length) setCategoryId(categories[0].id); }, [categories, categoryId]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !categoryId) return;
    const maxOrder = subcategories.filter((sc) => sc.categoryId === categoryId).reduce((m, sc) => Math.max(m, sc.sortOrder), 0);
    const err = await dbCreateSubcategory({ categoryId, name: n, sortOrder: maxOrder + 10 });
    if (err) { setError(err); return; }
    setName(""); setError("");
    refetch();
  };

  const remove = async (id: string) => {
    if (confirm("Видалити підкатегорію? Товари в ній стануть без підкатегорії.")) { await dbDeleteSubcategory(id); refetch(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Підкатегорії — рівень нижче категорії (напр. типи ролів). На сайті зʼявляються окремою
        навігацією над товарами, коли обрано відповідну категорію.
      </p>

      <form className={s.card} onSubmit={add}>
        <div className={s.cardHead}><div className={s.cardTitle}>Нова підкатегорія</div></div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ minWidth: 180 }}>
              <span className={s.fieldLabel}>Категорія</span>
              <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={s.field} style={{ flex: 1, minWidth: 200 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input className={s.input} placeholder="Напр. Темпури" value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }} />
            </div>
            <button className={s.btn} type="submit" disabled={!name.trim() || !categoryId}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Підкатегорії ({subcategories.length})</div></div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Назва</th><th>Категорія</th><th>Slug</th><th>Порядок</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : subcategories.map((sc) => (
                <tr key={sc.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{sc.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{catName(sc.categoryId)}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{sc.slug}</td>
                  <td>{sc.sortOrder}</td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(sc)}>Редагувати</button>
                      {isAdmin && <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(sc.id)}>Видалити</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <Modal
          title="Редагувати підкатегорію"
          onClose={() => setEdit(null)}
          footer={<>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setEdit(null)}>Скасувати</button>
            <button className={s.btn} onClick={saveEdit} disabled={!edit.name.trim()}>Зберегти</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Назва</span>
              <input className={s.input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Категорія</span>
              <select className={s.input} value={edit.categoryId} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className={s.field}><span className={s.fieldLabel}>Порядок</span>
              <input className={`${s.input} no-spin`} type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></div>
            <p className={s.hint} style={{ fontSize: 11 }}>Slug лишається незмінним (на нього посилаються товари).</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
