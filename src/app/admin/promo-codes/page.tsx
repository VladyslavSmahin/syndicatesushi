"use client";

import { useState } from "react";
import { usePromoCodes, promoCodesStore, type PromoCode } from "@/features/admin/stores";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

export default function PromoCodesPage() {
  const codes = usePromoCodes();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(10);
  const [error, setError] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (codes.some((x) => x.code.toUpperCase() === c)) { setError("Такий код вже існує"); return; }
    promoCodesStore.add({ code: c, discountType, value, isActive: true });
    setCode(""); setValue(10); setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Промокоди застосовуються під час оформлення замовлення. Тип знижки — відсоток або
        фіксована сума. Валідація (термін, ліміт) виконуватиметься на сервері.
      </p>

      <form className={s.card} onSubmit={add}>
        <div className={s.cardHead}><div className={s.cardTitle}>Новий промокод</div></div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ flex: 1, minWidth: 160 }}>
              <span className={s.fieldLabel}>Код</span>
              <input className={s.input} placeholder="SUSHI10" value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} />
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>Тип</span>
              <select className={s.input} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}>
                <option value="percent">Відсоток %</option>
                <option value="fixed">Фікс. сума</option>
              </select>
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>{discountType === "percent" ? "Відсоток" : "Сума, грн"}</span>
              <input className={s.input} type="number" style={{ width: 120 }} value={value} onChange={(e) => setValue(Number(e.target.value))} />
            </div>
            <button className={s.btn} type="submit" disabled={!code.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      <div className={s.card}>
        <div className={s.cardHead}><div className={s.cardTitle}>Промокоди ({codes.length})</div></div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Код</th><th>Знижка</th><th>Активний</th><th style={{ textAlign: "right" }}>Дії</th></tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, letterSpacing: 1 }}>{c.code}</td>
                  <td>{c.discountType === "percent" ? `${c.value}%` : `${c.value} грн`}</td>
                  <td>
                    <button className={`${s.pill} ${c.isActive ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                      onClick={() => promoCodesStore.update(c.id, { isActive: !c.isActive })}>
                      {c.isActive ? "Так" : "Ні"}
                    </button>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      {isAdmin ? (
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => promoCodesStore.remove(c.id)}>Видалити</button>
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
