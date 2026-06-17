"use client";

import { useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useDbPromos, useDbProducts, dbCreatePromo, dbUpdatePromo, dbSetPromoActive, dbDeletePromo,
  type DbPromo, type PromoInput,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import BannersPanel from "@/components/admin/BannersPanel";
import AdminSelect from "@/components/admin/AdminSelect";
import s from "@/components/admin/admin.module.css";

type Draft = PromoInput;
type Tab = "promos" | "banners";

export default function PromosPage() {
  const { promos, loading, refetch } = useDbPromos();
  const { products } = useDbProducts();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("promos");

  const active = products.filter((p) => !p.deletedAt);
  const [editing, setEditing] = useState<DbPromo | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  // стара ціна = поточна ціна товару з БД (read-only, не вводиться вручну)
  const priceOf = (id: string | null) => products.find((p) => p.id === id)?.price ?? 0;

  const openNew = () => {
    setEditing(null);
    const pid = active[0]?.id ?? null;
    setDraft({ productId: pid, price: 0, oldPrice: priceOf(pid), isActive: true, validFrom: null, validUntil: null });
  };
  const openEdit = (p: DbPromo) => {
    setEditing(p);
    setDraft({ productId: p.productId, price: p.price, oldPrice: priceOf(p.productId), isActive: p.isActive, validFrom: p.validFrom, validUntil: p.validUntil });
  };
  const close = () => { setDraft(null); setEditing(null); };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft || !draft.productId) return;
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
      <div style={{ display: "flex", gap: 8 }}>
        <button className={`${s.btn} ${s.btnSmall} ${tab === "promos" ? "" : s.btnGhost}`} onClick={() => setTab("promos")}>Акції</button>
        <button className={`${s.btn} ${s.btnSmall} ${tab === "banners" ? "" : s.btnGhost}`} onClick={() => setTab("banners")}>Баннери</button>
      </div>

      {tab === "banners" ? <BannersPanel /> : (
      <>
      <p className={s.hint}>
        Акції — спецціна на товар (перерахунок на сервері). Банер головної — у вкладці «Баннери»
        (клієнт завантажує готову картинку, сайт конвертує у WebP).
      </p>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Акції ({promos.length})</div>
          <button className={`${s.btn} ${s.btnSmall}`} onClick={openNew} disabled={!active.length}>+ Акція</button>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Товар</th><th>Ціна</th><th>Стара</th><th>Активна</th><th style={{ textAlign: "right" }}>Дії</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 20, color: "var(--text-secondary)" }}>Завантаження…</td></tr>
              ) : promos.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{productName(p.productId)}</td>
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
            <button className={s.btn} onClick={save} disabled={!draft.productId || saving}>{saving ? "Збереження…" : "Зберегти"}</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Товар</span>
              <AdminSelect
                value={draft.productId}
                onChange={(v) => setDraft((d) => (d ? { ...d, productId: v, oldPrice: priceOf(v) } : d))}
                options={active.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Оберіть товар"
                searchPlaceholder="Пошук товару…"
              /></div>
            <div style={{ display: "flex", gap: 14 }}>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Акційна ціна</span>
                <input className={`${s.input} no-spin`} type="number" value={draft.price || ""} onChange={(e) => set("price", e.target.value === "" ? 0 : Number(e.target.value))} /></div>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Стара ціна (з БД)</span>
                <input className={`${s.input} no-spin`} type="number" value={draft.oldPrice || ""} readOnly disabled title="Підтягується з ціни товару" style={{ opacity: 0.6, cursor: "not-allowed" }} /></div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Діє з (необовʼязково)</span>
                <input className={s.input} type="date" value={draft.validFrom ?? ""} onChange={(e) => set("validFrom", e.target.value || null)} /></div>
              <div className={s.field} style={{ flex: 1 }}><span className={s.fieldLabel}>Діє до (необовʼязково)</span>
                <input className={s.input} type="date" value={draft.validUntil ?? ""} onChange={(e) => set("validUntil", e.target.value || null)} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Активна
            </label>
          </div>
        </Modal>
      )}
      </>
      )}
    </div>
  );
}
