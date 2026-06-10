"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./icons";
import { useCart } from "@/features/cart/CartContext";

const qtyBtn: CSSProperties = {
  width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-primary)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

type Step = "cart" | "checkout" | "done";
type Delivery = "delivery" | "pickup";

export default function CartDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { items, total, changeQty, remove, clear } = useCart();
  const [step, setStep] = useState<Step>("cart");

  // checkout form
  const [delivery, setDelivery] = useState<Delivery>("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [promo, setPromo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // скидання кроку при закритті
  useEffect(() => {
    if (!isOpen) setStep(items.length ? "cart" : "cart");
  }, [isOpen, items.length]);

  if (!isOpen) return null;

  const canSubmit =
    name.trim() && phone.trim() && (delivery === "pickup" || address.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery, name, phone, address, comment, promo, items,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      // Замовлення прийнято → сповіщення пішло в Telegram (route handler).
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
      <div
        onClick={onClose}
        className="fade-in"
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 900 }}
      />
      <aside
        className="slide-in"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px, 100%)", background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)", zIndex: 950, display: "flex", flexDirection: "column",
        }}
      >
        {/* header */}
        <div style={{ padding: "28px 28px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
            {step === "checkout" ? "Оформлення" : step === "done" ? "Готово" : "Кошик"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Закрити"
            style={{ width: 36, height: 36, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon.Close width="14" height="14" />
          </button>
        </div>

        {/* ===== DONE ===== */}
        {step === "done" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--accent)", marginBottom: 14 }}>
              Дякуємо!
            </div>
            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, maxWidth: 280 }}>
              Замовлення прийнято. Найближчим часом ми зв&apos;яжемося з вами для підтвердження.
            </p>
            <button className="btn-primary" style={{ marginTop: 28 }} onClick={onClose}>
              Чудово
            </button>
          </div>
        ) : items.length === 0 ? (
          /* ===== EMPTY ===== */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", padding: 32 }}>
            <div style={{ marginBottom: 16, opacity: 0.4 }}>
              <Icon.Cart width="48" height="48" />
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18 }}>Кошик порожній</p>
            <p style={{ fontSize: 11, marginTop: 8, letterSpacing: 1 }}>Оберіть страви з меню</p>
          </div>
        ) : step === "cart" ? (
          /* ===== CART LIST ===== */
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 28px" }}>
              {items.map((item) => (
                <div key={item.id} style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6, letterSpacing: 1 }}>{item.price} грн</div>
                    </div>
                    <button
                      onClick={() => remove(item.id)}
                      aria-label="Видалити"
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      <Icon.Trash width="16" height="16" />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-light)" }}>
                      <button onClick={() => changeQty(item.id, -1)} style={qtyBtn}><Icon.Minus width="12" height="12" /></button>
                      <span style={{ minWidth: 32, textAlign: "center", fontSize: 13, fontWeight: 400, color: "var(--text-primary)" }}>{item.qty}</span>
                      <button onClick={() => changeQty(item.id, +1)} style={qtyBtn}><Icon.Plus width="12" height="12" /></button>
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{item.price * item.qty} грн</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "22px 28px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>Разом</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text-primary)" }}>{total} грн</span>
              </div>
              <button className="btn-primary" style={{ width: "100%" }} onClick={() => setStep("checkout")}>
                Оформити замовлення
              </button>
            </div>
          </>
        ) : (
          /* ===== CHECKOUT FORM ===== */
          <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* delivery toggle */}
              <div style={{ display: "flex", gap: 8 }}>
                {([["delivery", "Доставка"], ["pickup", "Самовивіз"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDelivery(val)}
                    style={{
                      flex: 1, padding: "12px 0", cursor: "pointer",
                      fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                      background: delivery === val ? "var(--bg-elevated)" : "transparent",
                      border: `1px solid ${delivery === val ? "var(--accent)" : "var(--border-light)"}`,
                      color: delivery === val ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input className="form-input" placeholder="Ім'я *" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="form-input" placeholder="Телефон *" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {delivery === "delivery" && (
                <input className="form-input" placeholder="Адреса доставки *" value={address} onChange={(e) => setAddress(e.target.value)} />
              )}
              <input className="form-input" placeholder="Промокод" value={promo} onChange={(e) => setPromo(e.target.value)} />
              <textarea className="form-input" placeholder="Коментар до замовлення" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 80 }} />
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "20px 28px 28px" }}>
              {error && (
                <p style={{ fontSize: 11, color: "#E0726A", marginBottom: 14, lineHeight: 1.5 }}>{error}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)" }}>До сплати</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{total} грн</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: "0 0 auto" }} onClick={() => setStep("cart")} disabled={submitting}>
                  Назад
                </button>
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
