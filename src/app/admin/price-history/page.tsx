"use client";

import { useDbPriceHistory, dbRevertPriceChange, type PriceHistoryEntry } from "@/features/admin/priceHistory";
import { useState } from "react";
import s from "@/components/admin/admin.module.css";

export default function PriceHistoryPage() {
  const { history, loading, refetch } = useDbPriceHistory();

  const revert = async (entry: PriceHistoryEntry) => { await dbRevertPriceChange(entry); refetch(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Історія змін цін — одиночних (редагування товару) та масових (за інгредієнтом).
        Будь-яку зміну можна відкотити: цінам повернуться попередні значення.
      </p>

      {loading ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : history.length === 0 ? (
        <div className={s.card}>
          <div className={s.placeholder}>
            <div className={s.placeholderTitle}>Поки порожньо</div>
            <p className={s.hint}>Зміни цін зʼявляться тут автоматично.</p>
          </div>
        </div>
      ) : (
        // компактний список: одна зміна — один рядок; масова зміна розгортається тапом
        <div className={s.card} style={{ padding: 0 }}>
          {history.map((entry, i) => <Entry key={entry.id} entry={entry} first={i === 0} onRevert={() => revert(entry)} />)}
        </div>
      )}
    </div>
  );
}

const nowYear = new Date().getFullYear();
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit", ...(d.getFullYear() !== nowYear ? { year: "2-digit" } : null), hour: "2-digit", minute: "2-digit",
  });
};

const one: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function Price({ from, to }: { from: number; to: number }) {
  return (
    <span style={{ whiteSpace: "nowrap", fontSize: 13, flexShrink: 0 }}>
      <span style={{ color: "var(--text-secondary)" }}>{from}</span>
      <span style={{ color: "var(--text-secondary)", margin: "0 4px" }}>→</span>
      <span style={{ color: to > from ? "var(--gold)" : "var(--accent)" }}>{to}</span>
      <span style={{ color: "var(--text-secondary)", fontSize: 11 }}> грн</span>
    </span>
  );
}

function Entry({ entry, first, onRevert }: { entry: PriceHistoryEntry; first: boolean; onRevert: () => void }) {
  const [open, setOpen] = useState(false);
  const bulk = entry.type === "bulk" || entry.changes.length > 1;
  const single = !bulk ? entry.changes[0] : null;
  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border)", opacity: entry.reverted ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", minHeight: 40 }}>
        <span className={s.hint} style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{shortDate(entry.at)}</span>
        {bulk ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            style={{ ...one, flex: 1, minWidth: 0, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text-primary)", fontSize: 13 }}>
            <span style={{ display: "inline-block", marginRight: 6, color: "var(--text-secondary)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
            {entry.label}
            <span className={s.hint} style={{ fontSize: 11 }}> · {entry.changes.length} тов.</span>
          </button>
        ) : (
          <span style={{ ...one, flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)" }}>{single?.name ?? entry.label}</span>
        )}
        {single && <Price from={single.from} to={single.to} />}
        {entry.reverted ? (
          <span className={s.hint} style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>відкочено</span>
        ) : (
          <button type="button" onClick={onRevert} title="Відкотити" aria-label={`Відкотити: ${entry.label}`}
            style={{ flexShrink: 0, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border-light)", borderRadius: 6, color: "var(--text-secondary)", cursor: "pointer", fontSize: 15 }}>
            ↶
          </button>
        )}
      </div>
      {bulk && open && (
        <div style={{ padding: "0 12px 8px 12px" }}>
          {entry.changes.map((c) => (
            <div key={c.productId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 4px 18px", borderTop: "1px dashed var(--border)" }}>
              <span style={{ ...one, flex: 1, minWidth: 0, fontSize: 12, color: "var(--text-primary)" }}>{c.name}</span>
              <Price from={c.from} to={c.to} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
