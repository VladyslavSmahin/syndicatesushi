"use client";

import { usePriceHistory, revertPriceChange, type PriceHistoryEntry } from "@/features/admin/priceHistory";
import s from "@/components/admin/admin.module.css";

export default function PriceHistoryPage() {
  const history = usePriceHistory();
  const sorted = [...history].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Історія змін цін — одиночних (редагування товару) та масових (за інгредієнтом).
        Будь-яку зміну можна відкотити: цінам повернуться попередні значення.
      </p>

      {sorted.length === 0 ? (
        <div className={s.card}>
          <div className={s.placeholder}>
            <div className={s.placeholderTitle}>Поки порожньо</div>
            <p className={s.hint}>Зміни цін зʼявляться тут автоматично.</p>
          </div>
        </div>
      ) : (
        sorted.map((entry) => <Entry key={entry.id} entry={entry} />)
      )}
    </div>
  );
}

function Entry({ entry }: { entry: PriceHistoryEntry }) {
  const date = new Date(entry.at).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className={`${s.pill} ${entry.type === "bulk" ? s.pillAdmin : s.pillEditor}`}>
            {entry.type === "bulk" ? "Масова" : "Одиночна"}
          </span>
          <span className={s.cardTitle} style={{ fontSize: 16 }}>{entry.label}</span>
          <span className={s.hint} style={{ fontSize: 11 }}>{date} · {entry.changes.length} товар(ів)</span>
        </div>
        {entry.reverted ? (
          <span className={`${s.pill} ${s.pillOff}`}>Відкочено</span>
        ) : (
          <button className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => revertPriceChange(entry)}>
            Відкотити
          </button>
        )}
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>Товар</th><th>Було</th><th>Стало</th></tr></thead>
          <tbody>
            {entry.changes.map((c) => (
              <tr key={c.productId}>
                <td>{c.name}</td>
                <td style={{ color: "var(--text-secondary)" }}>{c.from} грн</td>
                <td style={{ color: c.to > c.from ? "var(--gold)" : "var(--accent)" }}>{c.to} грн</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
