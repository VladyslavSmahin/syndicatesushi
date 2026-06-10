"use client";

import { useState } from "react";
import Modal from "@/components/admin/Modal";
import { usePromos, promosStore, useProducts, type AdminPromo } from "@/features/admin/stores";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

type Draft = Omit<AdminPromo, "id">;

export default function PromosPage() {
  const promos = usePromos();
  const products = useProducts();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [editing, setEditing] = useState<AdminPromo | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  const openNew = () => {
    setEditing(null);
    setDraft({ title: "", label: "", productId: products[0]?.id ?? "", price: 0, oldPrice: 0, isActive: true });
  };
  const openEdit = (p: AdminPromo) => { setEditing(p); const { id: _id, ...rest } = p; void _id; setDraft(rest); };
  const close = () => { setDraft(null); setEditing(null); };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = () => {
    if (!draft || !draft.title.trim()) return;
    if (editing) promosStore.update(editing.id, draft);
    else promosStore.add(draft);
    close();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Акції — банери на головній + «товар тижня». Накладаються на товар незалежно від
        його категорії (товар лишається у своїй категорії, але отримує спецціну й бейдж акції).
      </p>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Акції ({promos.length})</div>
          <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew}>+ Акція</button>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Заголовок</th><th>Плашка</th><th>Товар</th><th>Ціна</th><th>Стара</th><th>Активна</th><th style={{ textAlign: "right" }}>Дії</th></tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{p.title}</td>
                  <td><span className={`${s.pill} ${s.pillEditor}`}>{p.label}</span></td>
                  <td style={{ color: "var(--text-secondary)" }}>{productName(p.productId)}</td>
                  <td style={{ color: "var(--accent)" }}>{p.price} грн</td>
                  <td style={{ color: "var(--text-secondary)", textDecoration: "line-through" }}>{p.oldPrice} грн</td>
                  <td>
                    <button className={`${s.pill} ${p.isActive ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => promosStore.update(p.id, { isActive: !p.isActive })}>
                      {p.isActive ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(p)}>Редагувати</button>
                      {isAdmin && <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => promosStore.remove(p.id)}>Видалити</button>}
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
          title={editing ? "Редагувати акцію" : "Нова акція"}
          onClose={close}
          footer={<>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={close}>Скасувати</button>
            <button className={s.btn} onClick={save} disabled={!draft.title.trim()}>Зберегти</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Заголовок</span>
              <input className={s.input} value={draft.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Плашка</span>
              <input className={s.input} placeholder="РОЛ ДНЯ" value={draft.label} onChange={(e) => set("label", e.target.value)} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Товар</span>
              <select className={s.input} value={draft.productId} onChange={(e) => set("productId", e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div style={{ display: "flex", gap: 14 }}>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Акційна ціна</span>
                <input className={s.input} type="number" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} /></div>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Стара ціна</span>
                <input className={s.input} type="number" value={draft.oldPrice} onChange={(e) => set("oldPrice", Number(e.target.value))} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Активна
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
