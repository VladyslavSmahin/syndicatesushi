"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createIngredientAction, updateIngredientAction, deleteIngredientAction,
} from "@/features/admin/actions/ingredients";
import type { AdminIngredient } from "@/features/admin/ingredientsShared";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import AdminSearch from "./AdminSearch";
import Modal from "./Modal";
import Pagination from "./Pagination";
import s from "./admin.module.css";

type NutField = "kcal" | "protein" | "fat" | "carbs";
const NUT_LABEL: Record<NutField, string> = { kcal: "Ккал", protein: "Білки", fat: "Жири", carbs: "Вугл." };
const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const str = (v: number | null) => (v != null ? String(v) : "");

interface EditDraft { id: string; name: string; kcal: string; protein: string; fat: string; carbs: string; }

export default function IngredientsClient({
  rows, total, page, pageCount,
}: { rows: AdminIngredient[]; total: number; page: number; pageCount: number }) {
  const router = useRouter();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";
  const [pending, start] = useTransition();

  const [draft, setDraft] = useState({ name: "", kcal: "", protein: "", fat: "", carbs: "" });
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState("");

  const openEdit = (ing: AdminIngredient) => {
    setEdit({ id: ing.id, name: ing.name, kcal: str(ing.kcal), protein: str(ing.protein), fat: str(ing.fat), carbs: str(ing.carbs) });
    setEditError("");
  };
  const saveEdit = () => {
    if (!edit || !edit.name.trim()) return;
    start(async () => {
      const res = await updateIngredientAction(edit.id, {
        name: edit.name, kcal: num(edit.kcal), protein: num(edit.protein), fat: num(edit.fat), carbs: num(edit.carbs),
      });
      if (res.error) { setEditError(res.error); return; }
      setEdit(null);
      router.refresh();
    });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = draft.name.trim();
    if (!n) return;
    start(async () => {
      const res = await createIngredientAction(n, { kcal: num(draft.kcal), protein: num(draft.protein), fat: num(draft.fat), carbs: num(draft.carbs) });
      if (res.error) { setError(res.error); return; }
      setDraft({ name: "", kcal: "", protein: "", fat: "", carbs: "" });
      setError("");
      router.refresh();
    });
  };

  const setNut = (id: string, field: NutField, value: number | null) =>
    start(async () => { await updateIngredientAction(id, { [field]: value }); router.refresh(); });

  const remove = (id: string) => {
    if (!confirm("Видалити інгредієнт? Він прибереться з усіх товарів.")) return;
    start(async () => { const res = await deleteIngredientAction(id); if (res.error) alert(res.error); router.refresh(); });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Інгредієнти — окрема сутність для фільтрації каталогу. КБЖУ вказується <b>на 100 г</b>
        (редагується прямо в таблиці, зберігається при розфокусі). Пошук і сторінки працюють через базу.
      </p>

      <form className={s.card} onSubmit={add}>
        <div className={s.cardHead}><div className={s.cardTitle}>Новий інгредієнт</div></div>
        <div className={s.cardBody}>
          <div className={s.formRow} style={{ alignItems: "flex-end" }}>
            <div className={s.field} style={{ flex: "1 1 160px", minWidth: 140 }}>
              <span className={s.fieldLabel}>Назва</span>
              <input className={s.input} placeholder="Напр. Манго" value={draft.name}
                onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setError(""); }} />
            </div>
            {(["kcal", "protein", "fat", "carbs"] as NutField[]).map((f) => (
              <div key={f} className={s.field} style={{ flex: "1 1 64px", minWidth: 60 }}>
                <span className={s.fieldLabel}>{NUT_LABEL[f]}</span>
                <input className={`${s.input} no-spin`} type="number" step="0.1" min="0" placeholder="—" value={draft[f]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />
              </div>
            ))}
            <button className={s.btn} type="submit" disabled={!draft.name.trim() || pending}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      {/* minHeight: коли пошук нічого не знаходить, сторінка не «схлопується» —
          інакше браузер підрізає скрол і екран стрибає (особливо на телефоні з клавіатурою) */}
      <div className={s.card} style={{ minHeight: "100vh" }}>
        <div className={s.cardHead} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className={s.cardTitle}>Інгредієнти</div>
          <AdminSearch placeholder="Пошук за назвою…" />
        </div>
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.nutTable}`}>
            <thead>
              <tr><th>Назва</th><th>Ккал</th><th>Білки, г</th><th>Жири, г</th><th>Вугл., г</th><th style={{ textAlign: "right" }}>Дії</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-secondary)" }}>Нічого не знайдено</td></tr>
              ) : rows.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{ing.name}</td>
                  {(["kcal", "protein", "fat", "carbs"] as NutField[]).map((f) => (
                    <td key={f} className={s.nutCell} data-label={NUT_LABEL[f]}>
                      <NutCell value={ing[f]} onCommit={(v) => setNut(ing.id, f, v)} />
                    </td>
                  ))}
                  <td>
                    <div className={s.rowActions}>
                      <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => openEdit(ing)} disabled={pending}>Редагувати</button>
                      {isAdmin && (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(ing.id)} disabled={pending}>Видалити</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0 22px" }}>
          <Pagination page={page} pageCount={pageCount} total={total} />
        </div>
      </div>

      {edit && (
        <Modal
          title="Редагувати інгредієнт"
          onClose={() => setEdit(null)}
          footer={<>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setEdit(null)}>Скасувати</button>
            <button className={s.btn} onClick={saveEdit} disabled={!edit.name.trim() || pending}>Зберегти</button>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.field}><span className={s.fieldLabel}>Назва</span>
              <input className={s.input} value={edit.name}
                onChange={(e) => { setEdit({ ...edit, name: e.target.value }); setEditError(""); }} /></div>
            <div className={s.formRow}>
              {(["kcal", "protein", "fat", "carbs"] as NutField[]).map((f) => (
                <div key={f} className={s.field} style={{ flex: "1 1 64px", minWidth: 60 }}>
                  <span className={s.fieldLabel}>{NUT_LABEL[f]}</span>
                  <input className={`${s.input} no-spin`} type="number" step="0.1" min="0" placeholder="—" value={edit[f]}
                    onChange={(e) => setEdit({ ...edit, [f]: e.target.value })} />
                </div>
              ))}
            </div>
            {editError && <p className={s.error}>{editError}</p>}
            <p className={s.hint} style={{ fontSize: 11 }}>КБЖУ — на 100 г.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

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
