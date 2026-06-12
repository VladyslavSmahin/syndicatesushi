"use client";

import { useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useDbPromos, useDbProducts, dbCreatePromo, dbUpdatePromo, dbSetPromoActive, dbDeletePromo,
  type DbPromo, type PromoInput,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

type Draft = PromoInput;

export default function PromosPage() {
  const { promos, loading, refetch } = useDbPromos();
  const { products } = useDbProducts();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const active = products.filter((p) => !p.deletedAt);
  const [editing, setEditing] = useState<DbPromo | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";

  const openNew = () => {
    setEditing(null);
    setDraft({ productId: active[0]?.id ?? null, label: "", title: "", price: 0, oldPrice: 0, bannerImagePath: "", isActive: true });
  };
  const openEdit = (p: DbPromo) => {
    setEditing(p);
    setDraft({ productId: p.productId, label: p.label, title: p.title, price: p.price, oldPrice: p.oldPrice, bannerImagePath: p.bannerImagePath, isActive: p.isActive });
  };
  const close = () => { setDraft(null); setEditing(null); };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    const err = editing ? await dbUpdatePromo(editing.id, draft) : await dbCreatePromo(draft);
    setSaving(false);
    if (err) { alert("Помилка: " + err); return; }
    close(); refetch();
  };
  const toggle = async (p: DbPromo) => { await dbSetPromoActive(p.id, !p.isActive); refetch(); };
  const remove = async (p: DbPromo) => { await dbDeletePromo(p.id); refetch(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Акції — банери-слайдер на головній + спецціна на товар. Активні акції одразу зʼявляються на сайті.
        Банер поки задається шляхом (напр. <code>/assets/promo-imperia.png</code>); завантаження в Storage додамо окремо.
      </p>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Акції ({promos.length})</div>
          <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew} disabled={!active.length}>+ Акція</button>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Заголовок</th><th>Плашка</th><th>Товар</th><th>Ціна</th><th>Стара</th><th>Активна</th><th style={{ textAlign: "right" }}>Дії</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : promos.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{p.title}</td>
                  <td>{p.label ? <span className={`${s.pill} ${s.pillEditor}`}>{p.label}</span> : "—"}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{productName(p.productId)}</td>
                  <td style={{ color: "var(--accent)" }}>{p.price} грн</td>
                  <td style={{ color: "var(--text-secondary)", textDecoration: "line-through" }}>{p.oldPrice || "—"}</td>
                  <td>
                    <button className={`${s.pill} ${p.isActive ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }} onClick={() => toggle(p)}>
                      {p.isActive ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(p)}>Редагувати</button>
                      {isAdmin && <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(p)}>Видалити</button>}
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
            <button className={s.btn} onClick={save} disabled={!draft.title.trim() || saving}>{saving ? "Збереження…" : "Зберегти"}</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Заголовок</span>
              <input className={s.input} value={draft.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Плашка</span>
              <input className={s.input} placeholder="РОЛ ДНЯ" value={draft.label} onChange={(e) => set("label", e.target.value)} /></div>
            <div className={s.field}><span className={s.fieldLabel}>Товар</span>
              <select className={s.input} value={draft.productId ?? ""} onChange={(e) => set("productId", e.target.value || null)}>
                {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div className={s.field}><span className={s.fieldLabel}>Банер (шлях до зображення)</span>
              <input className={s.input} placeholder="/assets/promo-imperia.png" value={draft.bannerImagePath} onChange={(e) => set("bannerImagePath", e.target.value)} /></div>
            <div style={{ display: "flex", gap: 14 }}>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Акційна ціна</span>
                <input className={`${s.input} no-spin`} type="number" value={draft.price || ""} onChange={(e) => set("price", e.target.value === "" ? 0 : Number(e.target.value))} /></div>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Стара ціна</span>
                <input className={`${s.input} no-spin`} type="number" value={draft.oldPrice || ""} onChange={(e) => set("oldPrice", e.target.value === "" ? 0 : Number(e.target.value))} /></div>
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
