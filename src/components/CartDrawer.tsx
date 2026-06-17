"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { useCart } from "@/features/cart/CartContext";
import { usePublicCatalog, useGloss } from "@/features/publicData";
import type { Product, CartItem } from "@/lib/types";

const EXTRAS_CATEGORY = "додатково";

const qtyBtn: CSSProperties = {
  width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-primary)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

type Step = "cart" | "checkout" | "done";
type Delivery = "delivery" | "pickup";

// Український номер: лише цифри, формат «093 728 42 98» (10 цифр, починається з 0).
function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("380")) d = "0" + d.slice(3);   // +380XX… → 0XX…
  else if (d.startsWith("80")) d = "0" + d.slice(2); // 80XX…  → 0XX…
  return d.slice(0, 10);
}
function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}
function isPhoneValid(raw: string): boolean {
  const d = phoneDigits(raw);
  return d.length === 10 && d.startsWith("0");
}

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { items, total, changeQty, remove, clear, add } = useCart();
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
  const [comment, setComment] = useState("");
  const [promo, setPromo] = useState("");
  // застосований промокод (підтверджений сервером) + повідомлення/стан перевірки
  const [promoInfo, setPromoInfo] = useState<{ code: string; discountType: "percent" | "fixed"; value: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (!isOpen) setStep("cart"); // скидаємо крок при закритті (щоб «Готово» не залипало)
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  // знижка рахується наживо з поточної суми (працює при зміні кількості)
  const discount = promoInfo
    ? Math.min(total, promoInfo.discountType === "percent" ? Math.round((total * promoInfo.value) / 100) : promoInfo.value)
    : 0;
  // вартість доставки рахується менеджером окремо (від 100 грн, залежно від відстані)
  const payable = Math.max(0, total - discount);

  // зміна поля промокоду — скидаємо застосований код і повідомлення
  const onPromoChange = (v: string) => {
    setPromo(v);
    if (promoInfo) setPromoInfo(null);
    if (promoMsg) setPromoMsg(null);
  };

  // перевірка промокоду на сервері (без створення замовлення)
  const applyPromo = async () => {
    const code = promo.trim();
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoMsg(null);
    try {
      const res = await fetch("/api/promo/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: total }),
      });
      const j = await res.json();
      if (res.status === 429) { setPromoMsg({ ok: false, text: "Забагато спроб, зачекайте хвилину." }); return; }
      if (j.valid) {
        setPromoInfo({ code, discountType: j.discountType, value: j.value });
        setPromoMsg({ ok: true, text: `Промокод застосовано: −${j.discount} грн` });
      } else {
        setPromoInfo(null);
        setPromoMsg({ ok: false, text: "Промокод неактуальний." });
      }
    } catch {
      setPromoMsg({ ok: false, text: "Не вдалося перевірити промокод." });
    } finally {
      setPromoChecking(false);
    }
  };

  const addrOk = delivery === "pickup" || !!address.trim();
  const phoneOk = isPhoneValid(phone);
  const canSubmit = !!name.trim() && phoneOk && addrOk && consent;

  const fullAddress = delivery === "delivery" ? address.trim() : "";

  // причина, чому кнопка «Підтвердити» неактивна (показуємо користувачу)
  const submitHint =
    !name.trim() ? "Вкажіть ім'я"
    : !phone.trim() ? "Вкажіть телефон"
    : !phoneOk ? "Невірний формат номера (напр. 093 728 42 98)"
    : delivery === "delivery" && !address.trim() ? "Вкажіть адресу доставки"
    : !consent ? "Підтвердіть згоду на обробку персональних даних"
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery, name, phone, address: fullAddress, comment, promo: promoInfo?.code ?? "", consent, items }),
      });
      if (!res.ok) throw new Error("request_failed");
      setStep("done");
      clear();
      setPromo(""); setPromoInfo(null); setPromoMsg(null);
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
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6, letterSpacing: 1 }}>
                        {item.oldPrice && <span style={{ textDecoration: "line-through", marginRight: 5 }}>{item.oldPrice}</span>}
                        <span style={{ color: item.oldPrice ? "var(--accent)" : "var(--text-secondary)" }}>{item.price} грн</span>
                      </div>
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
              <input className="form-input" type="tel" inputMode="numeric" autoComplete="tel"
                placeholder="093 728 42 98" value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))} />

              {delivery === "delivery" && (
                <div>
                  <input className="form-input" placeholder="Адреса доставки * (вулиця, будинок, квартира)"
                    value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" />
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                    Доставка — від 100 грн, далі залежно від відстані. Точну вартість підтвердимо при дзвінку.
                  </p>
                </div>
              )}

              <div>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="Промокод"
                    value={promo}
                    onChange={(e) => onPromoChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                    style={{ paddingRight: 124, textTransform: "uppercase" }}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={!promo.trim() || promoChecking || !!promoInfo}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      padding: "8px 16px", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
                      border: "1px solid var(--border-light)", borderRadius: 4, cursor: "pointer",
                      background: promoInfo ? "transparent" : "var(--bg-elevated)",
                      color: promoInfo ? "var(--accent)" : "var(--text-primary)",
                      opacity: !promo.trim() || promoChecking ? 0.5 : 1, transition: "all 0.2s",
                    }}
                  >
                    {promoChecking ? "…" : promoInfo ? "✓" : "Застосувати"}
                  </button>
                </div>
                {promoMsg && (
                  <p style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4, color: promoMsg.ok ? "var(--accent)" : "#E0726A" }}>{promoMsg.text}</p>
                )}
              </div>
              <textarea className="form-input" placeholder="Коментар до замовлення" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 80 }} />
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "20px 28px 28px" }}>
              {error && <p style={{ fontSize: 11, color: "#E0726A", marginBottom: 14, lineHeight: 1.5 }}>{error}</p>}

              {delivery === "delivery" && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>Доставка</span>
                  <span>від 100 грн (за відстанню)</span>
                </div>
              )}
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--accent)", marginBottom: 6 }}>
                  <span>Знижка{promoInfo ? ` (${promoInfo.code})` : ""}</span>
                  <span>−{discount} грн</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>До сплати</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{payable} грн</span>
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, cursor: "pointer", fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 1, width: 16, height: 16, flexShrink: 0, accentColor: "var(--accent)", cursor: "pointer" }} />
                <span>
                  Я погоджуюсь на обробку моїх персональних даних згідно з{" "}
                  <Link href="/privacy" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>Політикою конфіденційності</Link>
                  {" "}та умовами{" "}
                  <Link href="/oferta" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>публічної оферти</Link>.
                </span>
              </label>
              {submitHint && !submitting && (
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10, textAlign: "center" }}>
                  {submitHint}
                </p>
              )}
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
  const [open, setOpen] = useState(false);
  const title = useGloss("cart_extras");
  if (!extras.length) return null;
  const qtyOf = (id: string) => items.find((i) => i.id === id)?.qty ?? 0;
  const inCart = extras.reduce((n, p) => n + qtyOf(p.id), 0);
  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 16 }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: open ? 12 : 0 }}>
        <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>{title}</span>
        {inCart > 0 && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>· {inCart}</span>}
        <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: 13, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      {open && (
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
      )}
    </div>
  );
}
