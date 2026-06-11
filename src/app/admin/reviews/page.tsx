"use client";

import { useMemo, useState } from "react";
import { useDbReviews, dbSetReviewStatus, dbDeleteReview, type DbReview, type ReviewStatus } from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

const FILTERS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "pending", label: "На модерації" },
  { value: "approved", label: "Схвалені" },
  { value: "rejected", label: "Відхилені" },
  { value: "all", label: "Усі" },
];
const statusPill = (st: ReviewStatus) => (st === "approved" ? s.pillOn : st === "rejected" ? s.pillOff : s.pillEditor);
const statusLabel = (st: ReviewStatus) => (st === "approved" ? "Схвалено" : st === "rejected" ? "Відхилено" : "На модерації");

export default function ReviewsPage() {
  const { reviews, loading, refetch } = useDbReviews();
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");

  const shown = useMemo(() => (filter === "all" ? reviews : reviews.filter((r) => r.status === filter)), [reviews, filter]);
  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  const setStatus = async (id: string, st: ReviewStatus) => { await dbSetReviewStatus(id, st); refetch(); };
  const remove = async (id: string) => { if (confirm("Видалити відгук назавжди?")) { await dbDeleteReview(id); refetch(); } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Модерація відгуків із сайту. Схвалені показуються в блоці відгуків на сайті.
        Нових на модерації: <b>{pendingCount}</b>.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={`chip square ${filter === f.value ? "active" : ""}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : shown.length === 0 ? (
        <div className={s.card}><div className={s.placeholder}>
          <div className={s.placeholderTitle}>Відгуків немає</div>
          <p className={s.hint}>Тут зʼявляться відгуки з форми на сайті.</p>
        </div></div>
      ) : (
        shown.map((r) => (
          <div key={r.id} className={s.card}>
            <div className={s.cardHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className={`${s.pill} ${statusPill(r.status)}`}>{statusLabel(r.status)}</span>
                <span className={s.cardTitle} style={{ fontSize: 16 }}>{r.authorName}</span>
                <span style={{ color: "var(--accent)", fontSize: 13 }}>{r.rating ? "⭐".repeat(r.rating) : "—"}</span>
                <span className={s.hint} style={{ fontSize: 11 }}>{r.contact} · {new Date(r.createdAt).toLocaleDateString("uk-UA")}</span>
              </div>
              <div className={s.rowActions}>
                {r.status !== "approved" && <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => setStatus(r.id, "approved")}>Схвалити</button>}
                {r.status !== "rejected" && <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => setStatus(r.id, "rejected")}>Відхилити</button>}
                {isAdmin && <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`} onClick={() => remove(r.id)}>Видалити</button>}
              </div>
            </div>
            <div style={{ padding: "0 22px 18px" }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, fontStyle: "italic" }}>«{r.text}»</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
