"use client";

import { useEffect, useMemo } from "react";
import {
  useDbProducts, useDbCategories, dbRestore, dbHardDelete, dbPurgeExpired, type DbProduct,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

const DELETED_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function DeletedProductsPage() {
  const { products, loading, refetch } = useDbProducts();
  const { categories } = useDbCategories();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const deleted = useMemo(
    () => products.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt! < a.deletedAt! ? -1 : 1)),
    [products]
  );
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  // автоприбирання прострочених (понад 90 днів) при відкритті
  useEffect(() => { dbPurgeExpired(DELETED_RETENTION_DAYS).then(refetch); }, [refetch]);

  const daysLeft = (deletedAt: string) =>
    Math.max(0, DELETED_RETENTION_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / DAY_MS));

  const restore = async (p: DbProduct) => { await dbRestore(p.id); refetch(); };
  const purge = async (p: DbProduct) => {
    if (confirm(`Видалити «${p.name}» назавжди? Цю дію не можна скасувати.`)) { await dbHardDelete(p.id); refetch(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Кошик видалених товарів. Видалені позиції зберігаються <b>{DELETED_RETENTION_DAYS} днів</b>,
        після чого прибираються автоматично. До цього їх можна відновити. На сайті вони не показуються.
      </p>

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>У кошику ({deleted.length})</div>
        </div>

        {loading ? (
          <div style={{ padding: "32px 16px", color: "var(--text-secondary)", fontSize: 13 }}>Завантаження…</div>
        ) : deleted.length === 0 ? (
          <div style={{ padding: "32px 16px", color: "var(--text-secondary)", fontSize: 13 }}>
            Кошик порожній — видалених товарів немає.
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr><th>Назва</th><th>Категорія</th><th>Видалено</th><th>Зберігається</th><th style={{ textAlign: "right" }}>Дії</th></tr>
              </thead>
              <tbody>
                {deleted.map((p) => {
                  const left = daysLeft(p.deletedAt!);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0, border: "1px solid var(--border)", background: p.photo ? `#0A0908 url(${p.photo}) center/cover no-repeat` : "var(--bg-elevated)" }} />
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{catName(p.categoryId)}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{new Date(p.deletedAt!).toLocaleDateString("uk-UA")}</td>
                      <td>
                        <span className={`${s.pill} ${left <= 7 ? s.pillOff : s.pillOn}`}>{left > 0 ? `${left} дн.` : "сьогодні"}</span>
                      </td>
                      <td>
                        <div className={s.rowActions}>
                          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => restore(p)}>Відновити</button>
                          {isAdmin && (
                            <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => purge(p)}>Видалити назавжди</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
