"use client";

import { useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useDbCategories, dbCreateCategory, dbUpdateCategory, dbDeleteCategory,
  useDbNavSpecials, dbSetNavSpecialVisible, type DbCategory,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

interface EditDraft { id: string; name: string; slug: string; sortOrder: number; }

export default function CategoriesPage() {
  const { categories: cats, loading, refetch } = useDbCategories();
  const { specials, refetch: refetchSpecials } = useDbNavSpecials();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const toggleSpecial = async (id: string, visible: boolean) => {
    await dbSetNavSpecialVisible(specials, id, visible);
    refetchSpecials();
  };

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [editErr, setEditErr] = useState("");

  const openEdit = (c: DbCategory) => { setEdit({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder }); setEditErr(""); };
  const saveEdit = async () => {
    if (!edit) return;
    const nm = edit.name.trim(), sl = edit.slug.trim().toLowerCase();
    if (!nm || !sl) { setEditErr("Назва і slug обовʼязкові"); return; }
    if (cats.some((c) => c.id !== edit.id && c.slug === sl)) { setEditErr("Slug вже зайнятий"); return; }
    await dbUpdateCategory(edit.id, { name: nm, slug: sl, sortOrder: edit.sortOrder });
    setEdit(null);
    refetch();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const slug = n.toLowerCase().replace(/\s+/g, "-");
    if (cats.some((c) => c.slug === slug)) { setError("Категорія з такою назвою вже існує"); return; }
    const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const err = await dbCreateCategory({ name: n, slug, sortOrder: maxOrder + 10, showInNav: true, isActive: true });
    if (err) { setError(err); return; }
    setName(""); setError("");
    refetch();
  };

  const toggle = async (id: string, patch: Record<string, boolean>) => { await dbUpdateCategory(id, patch); refetch(); };
  const remove = async (id: string) => {
    if (confirm("Видалити категорію? Товари в ній стануть без категорії.")) { await dbDeleteCategory(id); refetch(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Категорії одразу зʼявляються в навігації сайту (у шапці та бургер-меню).
        Вимкніть «У навігації» або «Активна», щоб приховати без видалення.
      </p>

      <form className={s.card} onSubmit={handleAdd}>
        <div className={s.cardHead}><div className={s.cardTitle}>Нова категорія</div></div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ flex: 1, minWidth: 220 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input className={s.input} placeholder="Напр. Десерти" value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }} />
            </div>
            <button className={s.btn} type="submit" disabled={!name.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Категорії ({cats.length})</div></div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Назва</th><th>Slug</th><th>Порядок</th><th>У навігації</th><th>Активна</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : cats.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{c.slug}</td>
                  <td>{c.sortOrder}</td>
                  <td>
                    <button className={`${s.pill} ${c.showInNav ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => toggle(c.id, { showInNav: !c.showInNav })}>{c.showInNav ? "Так" : "Ні"}</button>
                  </td>
                  <td>
                    <button className={`${s.pill} ${c.isActive ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => toggle(c.id, { isActive: !c.isActive })}>{c.isActive ? "Так" : "Ні"}</button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(c)}>Редагувати</button>
                      {isAdmin && <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(c.id)}>Видалити</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Спец-пункти навігації (фіксовані сутності — лише вмикання/вимикання) */}
      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Спец-пункти навігації</div></div>
        <div style={{ padding: "8px 0" }}>
          <p className={s.hint} style={{ padding: "0 22px 8px" }}>
            «Новинки» (товари з бейджем НОВЕ) та «Акції» — закріплені пункти меню.
            Їх можна сховати з навігації, не видаляючи: вимкнення лише прибирає кнопку, сутність лишається.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>Пункт</th><th style={{ textAlign: "right" }}>У навігації</th></tr></thead>
              <tbody>
                {specials.map((sp) => (
                  <tr key={sp.id}>
                    <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{sp.label}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className={`${s.pill} ${sp.showInNav ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                        onClick={() => toggleSpecial(sp.id, !sp.showInNav)}>{sp.showInNav ? "Так" : "Ні"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {edit && (
        <Modal
          title="Редагувати категорію"
          onClose={() => setEdit(null)}
          footer={<>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setEdit(null)}>Скасувати</button>
            <button className={s.btn} onClick={saveEdit} disabled={!edit.name.trim()}>Зберегти</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Назва</span>
              <input className={s.input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Slug (для навігації/фільтра)</span>
              <input className={s.input} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Порядок</span>
              <input className={`${s.input} no-spin`} type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></div>
            {editErr && <p className={s.error}>{editErr}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
