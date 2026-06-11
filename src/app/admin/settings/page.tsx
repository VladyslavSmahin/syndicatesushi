"use client";

import { useEffect, useState } from "react";
import { useDbDelivery, dbSaveDelivery } from "@/features/admin/db";
import { quoteDelivery, type DeliverySettings } from "@/lib/delivery";
import s from "@/components/admin/admin.module.css";

const numField = (label: string, key: keyof DeliverySettings, hint?: string) => ({ label, key, hint });

const NUM_FIELDS = [
  numField("Координата закладу — широта", "originLat"),
  numField("Координата закладу — довгота", "originLng"),
  numField("Базова ціна, грн", "basePrice"),
  numField("Базова відстань, км", "baseKm", "входить у базову ціну"),
  numField("Доплата за крок, грн", "stepPrice"),
  numField("Крок, км", "stepKm"),
];

export default function DeliverySettingsPage() {
  const { delivery, loading, refetch } = useDbDelivery();
  const [draft, setDraft] = useState<DeliverySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading) setDraft(delivery); }, [loading, delivery]);

  const set = (key: keyof DeliverySettings, value: number | null) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const err = await dbSaveDelivery(draft);
    setSaving(false);
    if (err) { alert("Помилка: " + err); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    refetch();
  };

  // приклад розрахунку (на 3 км, замовлення 500 грн)
  const example = draft ? quoteDelivery(draft, draft.originLat + 0.027, draft.originLng, 500) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Доставка за адресою. Ціна рахується від координат закладу до адреси клієнта
        (відстань по прямій ×1.3). Координати закладу можна уточнити на Google Maps (правий клік → координати).
      </p>

      {loading || !draft ? (
        <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Завантаження…</p></div></div>
      ) : (
        <>
          <div className={s.card}>
            <div className={s.cardHead}><div className={s.cardTitle}>Тариф доставки</div></div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {NUM_FIELDS.map((f) => (
                  <div key={f.key} className={s.field} style={{ flex: "1 1 200px", minWidth: 180 }}>
                    <span className={s.fieldLabel}>{f.label}</span>
                    <input className={`${s.input} no-spin`} type="number" step="any"
                      value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value === "" ? 0 : Number(e.target.value))} />
                    {f.hint && <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>{f.hint}</span>}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div className={s.field} style={{ flex: "1 1 200px", minWidth: 180 }}>
                  <span className={s.fieldLabel}>Безкоштовно від суми, грн</span>
                  <input className={`${s.input} no-spin`} type="number" step="any" placeholder="вимкнено"
                    value={draft.freeFrom ?? ""} onChange={(e) => set("freeFrom", e.target.value === "" ? null : Number(e.target.value))} />
                  <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>порожньо = вимкнено</span>
                </div>
                <div className={s.field} style={{ flex: "1 1 200px", minWidth: 180 }}>
                  <span className={s.fieldLabel}>Макс. відстань доставки, км</span>
                  <input className={`${s.input} no-spin`} type="number" step="any" placeholder="без обмеження"
                    value={draft.maxKm ?? ""} onChange={(e) => set("maxKm", e.target.value === "" ? null : Number(e.target.value))} />
                  <span className={s.hint} style={{ fontSize: 11, marginTop: 4 }}>порожньо = без обмеження</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button className={s.btn} onClick={save} disabled={saving}>{saving ? "Збереження…" : "Зберегти"}</button>
                {saved && <span style={{ color: "var(--accent)", fontSize: 13 }}>✓ Збережено</span>}
              </div>
            </div>
          </div>

          {example && (
            <div className={s.card}>
              <div className={s.cardHead}><div className={s.cardTitle}>Приклад розрахунку</div></div>
              <div style={{ padding: 22 }}>
                <p className={s.hint}>
                  Адреса ~{example.km} км, замовлення 500 грн → доставка:{" "}
                  <b style={{ color: "var(--accent)" }}>
                    {example.free ? "безкоштовно" : example.outOfRange ? "поза зоною" : `${example.price} грн`}
                  </b>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
