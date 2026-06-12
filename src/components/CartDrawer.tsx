"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./icons";
import { useCart } from "@/features/cart/CartContext";
import { usePublicDelivery, usePublicCatalog } from "@/features/publicData";
import { quoteDelivery } from "@/lib/delivery";
import type { Product, CartItem } from "@/lib/types";

const EXTRAS_CATEGORY = "додатково";

const qtyBtn: CSSProperties = {
  width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-primary)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

type Step = "cart" | "checkout" | "done";
type Delivery = "delivery" | "pickup";
interface Suggestion { label: string; lat: number; lng: number; }

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; city?: string; town?: string; village?: string; county?: string };
}

function suggestionLabel(p: PhotonFeature["properties"]): string {
  const line1 = [p.street ?? p.name, p.housenumber].filter(Boolean).join(", ");
  const line2 = p.city ?? p.town ?? p.village ?? p.county ?? "";
  return [line1 || p.name, line2].filter(Boolean).join(", ");
}

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { items, total, changeQty, remove, clear, add } = useCart();
  const ds = usePublicDelivery();
  const catalog = usePublicCatalog();
  const extras = useMemo(
    () => catalog.filter((p) => p.category === EXTRAS_CATEGORY).sort((a, b) => a.price - b.price),
    [catalog]
  );
  const [step, setStep] = useState<Step>("cart");

  const [delivery, setDelivery] = useState<Delivery>("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [comment, setComment] = useState("");
  const [promo, setPromo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const skipSearch = useRef(false); // не шукати після вибору підказки

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (!isOpen) setStep("cart"); // скидаємо крок при закритті (щоб «Готово» не залипало)
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // автопідказки адреси (Photon/OSM) — debounce
  useEffect(() => {
    if (delivery !== "delivery" || skipSearch.current) { skipSearch.current = false; return; }
    const q = address.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        // Photon підтримує lang лише default/de/en/fr — для України беремо default (локальні назви укр.)
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${ds.originLat}&lon=${ds.originLng}&limit=5&lang=default`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json();
        const sugg: Suggestion[] = (data.features ?? []).map((f: PhotonFeature) => ({
          label: suggestionLabel(f.properties), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        })).filter((x: Suggestion) => x.label);
        setSuggestions(sugg);
      } catch { /* abort / network — ignore */ } finally { setSearching(false); }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [address, delivery, ds.originLat, ds.originLng]);

  if (!isOpen) return null;

  const dq = delivery === "delivery" && coords ? quoteDelivery(ds, coords.lat, coords.lng, total) : null;
  const deliveryFee = dq && !dq.outOfRange ? (dq.free ? 0 : dq.price) : 0;
  const payable = total + (delivery === "delivery" ? deliveryFee : 0);

  const addrOk = delivery === "pickup" || (!!coords && !dq?.outOfRange);
  const canSubmit = !!name.trim() && !!phone.trim() && addrOk;

  const pickSuggestion = (sg: Suggestion) => {
    skipSearch.current = true;
    setAddress(sg.label);
    setCoords({ lat: sg.lat, lng: sg.lng });
    setSuggestions([]);
  };
  const onAddressChange = (v: string) => { setAddress(v); setCoords(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery, name, phone, address, comment, promo, items, lat: coords?.lat, lng: coords?.lng }),
      });
      if (!res.ok) throw new Error("request_failed");
      setStep("done");
      clear();
    } catch {
      setError("Не вдалося надіслати замовлення. Спробуйте ще раз або зателефонуйте нам.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fade-in"
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 900 }} />
      <aside className="slide-in"
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px, 100%)", background: "var(--bg-card)", borderLeft: "1px solid var(--border)", zIndex: 950, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
            {step === "checkout" ? "Оформлення" : step === "done" ? "Готово" : "Кошик"}
          </h3>
          <button onClick={onClose} aria-label="Закрити"
            style={{ width: 36, height: 36, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.Close width="14" height="14" />
          </button>
        </div>

        {step === "done" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--accent)", marginBottom: 14 }}>Дякуємо!</div>
            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, maxWidth: 280 }}>
              Замовлення прийнято. Найближчим часом ми зв&apos;яжемося з вами для підтвердження.
            </p>
            <button className="btn-primary" style={{ marginTop: 28 }} onClick={onClose}>Чудово</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 28px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", padding: "48px 0 24px" }}>
              <div style={{ marginBottom: 16, opacity: 0.4 }}><Icon.Cart width="48" height="48" /></div>
              <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18 }}>Кошик порожній</p>
              <p style={{ fontSize: 11, marginTop: 8, letterSpacing: 1 }}>Оберіть страви з меню</p>
            </div>
            <ExtrasBlock extras={extras} items={items} add={add} />
          </div>
        ) : step === "cart" ? (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 28px" }}>
              {items.map((item) => (
                <div key={item.id} style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6, letterSpacing: 1 }}>{item.price} грн</div>
                    </div>
                    <button onClick={() => remove(item.id)} aria-label="Видалити"
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}>
                      <Icon.Trash width="16" height="16" />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-light)" }}>
                      <button onClick={() => changeQty(item.id, -1)} style={qtyBtn}><Icon.Minus width="12" height="12" /></button>
                      <span style={{ minWidth: 32, textAlign: "center", fontSize: 13, color: "var(--text-primary)" }}>{item.qty}</span>
                      <button onClick={() => changeQty(item.id, +1)} style={qtyBtn}><Icon.Plus width="12" height="12" /></button>
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{item.price * item.qty} грн</div>
                  </div>
                </div>
              ))}
              <ExtrasBlock extras={extras} items={items} add={add} />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", padding: "22px 28px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>Разом</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text-primary)" }}>{total} грн</span>
              </div>
              <button className="btn-primary" style={{ width: "100%" }} onClick={() => setStep("checkout")}>Оформити замовлення</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {([["delivery", "Доставка"], ["pickup", "Самовивіз"]] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setDelivery(val)}
                    style={{ flex: 1, padding: "12px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                      background: delivery === val ? "var(--bg-elevated)" : "transparent",
                      border: `1px solid ${delivery === val ? "var(--accent)" : "var(--border-light)"}`,
                      color: delivery === val ? "var(--accent)" : "var(--text-secondary)" }}>
                    {label}
                  </button>
                ))}
              </div>

              <input className="form-input" placeholder="Ім'я *" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="form-input" placeholder="Телефон *" value={phone} onChange={(e) => setPhone(e.target.value)} />

              {delivery === "delivery" && (
                <div style={{ position: "relative" }}>
                  <input className="form-input" placeholder="Адреса доставки * (оберіть зі списку)"
                    value={address} onChange={(e) => onAddressChange(e.target.value)} autoComplete="off" />
                  {suggestions.length > 0 && !coords && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderTop: "none", maxHeight: 220, overflowY: "auto" }}>
                      {suggestions.map((sg, i) => (
                        <button key={i} type="button" onClick={() => pickSuggestion(sg)}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
                          {sg.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {searching && !coords && <p className="hint" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Пошук…</p>}
                  {delivery === "delivery" && coords && dq && (
                    <p style={{ fontSize: 12, marginTop: 6, color: dq.outOfRange ? "#E0726A" : "var(--accent)" }}>
                      {dq.outOfRange ? `Поза зоною доставки (~${dq.km} км)` : dq.free ? `Безкоштовна доставка (~${dq.km} км)` : `Доставка: ${dq.price} грн (~${dq.km} км)`}
                    </p>
                  )}
                </div>
              )}

              <input className="form-input" placeholder="Промокод" value={promo} onChange={(e) => setPromo(e.target.value)} />
              <textarea className="form-input" placeholder="Коментар до замовлення" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 80 }} />
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "20px 28px 28px" }}>
              {error && <p style={{ fontSize: 11, color: "#E0726A", marginBottom: 14, lineHeight: 1.5 }}>{error}</p>}

              {delivery === "delivery" && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>Сума · Доставка</span>
                  <span>{total} грн · {coords ? (deliveryFee === 0 ? "безкоштовно" : `${deliveryFee} грн`) : "—"}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>До сплати</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{payable} грн</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: "0 0 auto" }} onClick={() => setStep("cart")} disabled={submitting}>Назад</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={!canSubmit || submitting}>
                  {submitting ? "Надсилаємо…" : "Підтвердити"}
                </button>
              </div>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}

function ExtrasBlock({ extras, items, add }: { extras: Product[]; items: CartItem[]; add: (p: Product) => void }) {
  if (!extras.length) return null;
  const qtyOf = (id: string) => items.find((i) => i.id === id)?.qty ?? 0;
  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 12 }}>Додатково</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
        {extras.map((p) => {
          const q = qtyOf(p.id);
          return (
            <button key={p.id} onClick={() => add(p)} aria-label={`Додати ${p.name}`}
              style={{
                position: "relative", textAlign: "left", cursor: "pointer",
                border: "1px solid var(--border-light)", background: q > 0 ? "var(--bg-elevated)" : "transparent",
                borderRadius: 8, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 4, minHeight: 64,
                color: "var(--text-primary)",
              }}>
              {/* плюсик у кутку */}
              <span style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 5, background: "var(--accent)", color: "#0A0908", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, lineHeight: 1, fontWeight: 700 }}>+</span>
              {q > 0 && <span style={{ position: "absolute", top: 6, left: 8, fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>×{q}</span>}
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, paddingRight: 20, marginTop: q > 0 ? 14 : 0 }}>{p.name}</span>
              <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: 0.5 }}>
                {p.weight ? `${p.weight} · ` : ""}{p.price} грн
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
