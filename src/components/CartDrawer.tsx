"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { useCart, MAX_QTY } from "@/features/cart/CartContext";
import { usePublicCatalog, useGloss, useContacts } from "@/features/publicData";
import PickupPicker from "./PickupPicker";
import { dayOptions, firstPickupDay, isPickupStillValid, weekdayLabel } from "@/lib/kyivTime";
import type { Product, CartItem } from "@/lib/types";
import { useScrollLock } from "@/lib/scrollLock";
import ThumbImg from "./ThumbImg";
import { formatPhone, isPhoneValid } from "@/lib/phone";
import { useCustomerProfile } from "@/features/account";

const EXTRAS_CATEGORY = "додатково";
// категорії, для яких потрібні набори приборів (палички, серветки)
const CUTLERY_CATEGORIES = ["сети", "роли", "hot/wok", "боули"];
const CUTLERY_MAX = 6;
/** Скільки наборів пропонуємо за замовчуванням, залежно від суми замовлення. */
const autoCutlery = (sum: number) => (sum >= 2000 ? 4 : sum >= 1500 ? 3 : sum >= 1000 ? 2 : 1);

const qtyBtn: CSSProperties = {
  width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-primary)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

type Step = "cart" | "checkout" | "done";
type Delivery = "delivery" | "pickup";

// ліміти довжини полів — ті самі, що перевіряє /api/order
const MAX_NAME = 100;
const MAX_PHONE = 30;
const MAX_ADDRESS = 300;
const MAX_COMMENT = 1000;
const MAX_PROMO = 50;

const PICKUP_RESET_MSG = "Обраний час уже минув — оберіть, будь ласка, новий.";
const GENERIC_ERROR = "Не вдалося надіслати замовлення. Спробуйте ще раз або зателефонуйте нам.";

/** Код помилки /api/order → зрозуміле повідомлення для клієнта. */
function orderErrorText(code: string | undefined, status: number): string {
  if (status === 429 || code === "rate_limited") return "Забагато спроб поспіль. Зачекайте хвилину й спробуйте ще раз.";
  switch (code) {
    case "missing_fields": return "Заповніть ім'я й телефон та перевірте, що в кошику є товари.";
    case "field_too_long": return "Задовгий текст в одному з полів (ім'я, телефон, адреса чи коментар). Скоротіть, будь ласка.";
    case "invalid_qty": return `Некоректна кількість товару: від 1 до ${MAX_QTY} шт однієї позиції.`;
    case "too_many_items": return "Забагато різних позицій в одному замовленні. Розбийте його на кілька або зателефонуйте нам.";
    case "item_unavailable": return "Деякі товари вже недоступні — ми прибрали їх з кошика. Перевірте замовлення й підтвердіть ще раз.";
    case "consent_required": return "Підтвердіть згоду на обробку персональних даних.";
    case "address_required": return "Вкажіть адресу доставки.";
    case "pickup_date_invalid": return "Обраний день уже недоступний — оберіть, будь ласка, інший.";
    case "pickup_time_passed": return PICKUP_RESET_MSG;
    case "pickup_time_invalid": return "Обраний час поза годинами роботи — оберіть, будь ласка, інший.";
    case "save_failed": return "Не вдалося зберегти замовлення. Спробуйте ще раз або зателефонуйте нам.";
    case "bad_json": case "bad_fields": case "bad_items": case "bad_delivery":
      return "Не вдалося обробити замовлення. Оновіть сторінку й спробуйте ще раз.";
    default: return GENERIC_ERROR;
  }
}

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { items, total, changeQty, remove, clear, add, syncCatalog, removeUnavailable, removedNotice, dismissRemovedNotice } = useCart();
  const catalog = usePublicCatalog();
  const contacts = useContacts();
  // звіряємо кошик (localStorage) з актуальним каталогом: ціни, назви, зниклі товари
  useEffect(() => { syncCatalog(catalog); }, [catalog, syncCatalog]);
  const extras = useMemo(
    () => catalog.filter((p) => p.category === EXTRAS_CATEGORY).sort((a, b) => a.price - b.price),
    [catalog]
  );
  const [step, setStep] = useState<Step>("cart");
  // категорія товару за id — щоб зрозуміти, чи потрібні прибори
  const catById = useMemo(() => new Map(catalog.map((p) => [p.id, p.category] as const)), [catalog]);

  const [delivery, setDelivery] = useState<Delivery>("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  // залогінений клієнт — підставляємо ім'я й номер із профілю (лише в порожні поля)
  const profile = useCustomerProfile(isOpen);
  useEffect(() => {
    if (!profile) return;
    if (profile.name) setName((v) => v || profile.name!.slice(0, MAX_NAME));
    if (profile.phone) setPhone((v) => v || formatPhone(profile.phone!));
  }, [profile]);
  // на коли (і доставка, і самовивіз): дата (за замовчуванням — найближчий день зі слотами,
  // за київським часом) і час ("" = якнайшвидше / по готовності)
  const [pickupDate, setPickupDate] = useState(() => firstPickupDay(contacts.hours));
  const [pickupTime, setPickupTime] = useState("");
  const [pickupChosen, setPickupChosen] = useState(false); // клієнт сам обирав день/час у пікері
  const [pickupMsg, setPickupMsg] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // сума з сервера після успішного замовлення (якщо відрізняється від показаної)
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [promo, setPromo] = useState("");
  // застосований промокод (підтверджений сервером) + повідомлення/стан перевірки
  const [promoInfo, setPromoInfo] = useState<{ code: string; discountType: "percent" | "fixed"; value: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false); // поле промокоду згорнуте за замовчуванням
  // прибори: null = авто за сумою; число = обрано вручну
  const [cutlery, setCutlery] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /** Перевіряє, чи обраний день/час самовивозу ще актуальні (час іде, поки кошик відкритий
   *  чи вкладка висить у фоні). Якщо ні — скидає на найближчий день «по готовності».
   *  Повертає true, якщо довелося скинути. */
  const revalidatePickup = (): boolean => {
    if (isPickupStillValid(pickupDate, pickupTime, contacts.hours)) return false;
    setPickupDate(firstPickupDay(contacts.hours));
    setPickupTime("");
    // скидання дефолтного значення — тихо; обраного клієнтом — з проханням обрати знову
    if (pickupChosen) setPickupMsg(PICKUP_RESET_MSG);
    setPickupChosen(false);
    return true;
  };

  useScrollLock(isOpen);
  useEffect(() => {
    if (!isOpen) {
      setStep("cart"); // скидаємо крок при закритті (щоб «Готово» не залипало)
      setServerTotal(null);
      return;
    }
    revalidatePickup(); // кошик могли відкрити через години/дні після попереднього вибору
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const needsCutlery = items.some((i) => CUTLERY_CATEGORIES.includes(catById.get(i.id) ?? ""));
  const cutleryQty = cutlery ?? autoCutlery(total);

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
    setError("");
    // слот міг минути, поки клієнт заповнював форму — просимо обрати знову
    if (revalidatePickup()) {
      setPickupMsg(PICKUP_RESET_MSG);
      setError(PICKUP_RESET_MSG);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery, name, phone, address: fullAddress, comment,
          scheduleDate: pickupDate,
          scheduleTime: pickupTime,
          cutlery: needsCutlery ? cutleryQty : 0,
          promo: promoInfo?.code ?? "", consent, items,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; badIds?: unknown; total?: unknown };
      if (!res.ok || !j.ok) {
        if (j.error === "item_unavailable" && Array.isArray(j.badIds)) {
          removeUnavailable(j.badIds.filter((x): x is string => typeof x === "string"));
        }
        if (j.error === "pickup_date_invalid" || j.error === "pickup_time_passed" || j.error === "pickup_time_invalid") {
          // сервер (київський час) не прийняв вибір — скидаємо на найближчий доступний
          setPickupDate(firstPickupDay(contacts.hours));
          setPickupTime("");
          setPickupChosen(false);
          setPickupMsg(orderErrorText(j.error, res.status));
        }
        setError(orderErrorText(j.error, res.status));
        return;
      }
      // показуємо серверну суму, якщо вона відрізняється від тієї, що бачив клієнт
      setServerTotal(typeof j.total === "number" && j.total !== payable ? j.total : null);
      setStep("done");
      clear();
      setPromo(""); setPromoInfo(null); setPromoMsg(null); setPromoOpen(false); setCutlery(null);
      setPickupMsg(""); setPickupChosen(false);
    } catch {
      setError(GENERIC_ERROR);
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
            {serverTotal != null && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 280, marginTop: 12 }}>
                Сума замовлення за актуальними цінами: <b style={{ color: "var(--text-primary)" }}>{serverTotal} грн</b>
              </p>
            )}
            <button className="btn-primary" style={{ marginTop: 28 }} onClick={onClose}>Чудово</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 28px", display: "flex", flexDirection: "column" }}>
            {removedNotice && <RemovedNotice onClose={dismissRemovedNotice} />}
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
              {removedNotice && <RemovedNotice onClose={dismissRemovedNotice} />}
              {items.map((item) => {
                // фото беремо з каталогу за id (у кошику в localStorage його немає)
                const photo = catalog.find((p) => p.id === item.id)?.photo;
                return (
                <div key={item.id} style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    <span className="mini-thumb">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <ThumbImg src={photo} alt="" loading="lazy" />
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 60 /* під назвою, а не під мініатюрою */ }}>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-light)" }}>
                      <button onClick={() => changeQty(item.id, -1)} aria-label="Менше" style={qtyBtn}><Icon.Minus width="12" height="12" /></button>
                      <span style={{ minWidth: 32, textAlign: "center", fontSize: 13, color: "var(--text-primary)" }}>{item.qty}</span>
                      <button onClick={() => changeQty(item.id, +1)} disabled={item.qty >= MAX_QTY} aria-label="Додати ще"
                        style={{ ...qtyBtn, ...(item.qty >= MAX_QTY ? { opacity: 0.35, cursor: "not-allowed" } : null) }}>
                        <Icon.Plus width="12" height="12" />
                      </button>
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{item.price * item.qty} грн</div>
                  </div>
                </div>
                );
              })}
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
                  <button key={val} type="button" onClick={() => { setDelivery(val); revalidatePickup(); }}
                    style={{ flex: 1, padding: "12px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                      background: delivery === val ? "var(--bg-elevated)" : "transparent",
                      border: `1px solid ${delivery === val ? "var(--accent)" : "var(--border-light)"}`,
                      color: delivery === val ? "var(--accent)" : "var(--text-secondary)" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* імʼя та телефон — в один рядок, кожне поле не тягне цілу ширину */}
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" placeholder="Ім'я *" value={name} maxLength={MAX_NAME}
                  onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                <input className="form-input" type="tel" inputMode="numeric" autoComplete="tel"
                  placeholder="093 728 42 98" value={phone} maxLength={MAX_PHONE}
                  onChange={(e) => setPhone(formatPhone(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
              </div>

              <PickupRow
                delivery={delivery}
                date={pickupDate}
                time={pickupTime}
                hours={contacts.hours}
                message={pickupMsg}
                onOpen={() => { if (!revalidatePickup()) setPickupMsg(""); setPickerOpen(true); }}
              />

              {delivery === "delivery" && (
                <div>
                  <input className="form-input" placeholder="Адреса доставки * (вулиця, будинок, квартира)"
                    value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" maxLength={MAX_ADDRESS} />
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                    Доставка — від 100 грн, далі залежно від відстані. Точну вартість підтвердимо при дзвінку.
                  </p>
                </div>
              )}

              {needsCutlery && (
                <CutleryRow value={cutleryQty} onChange={setCutlery} />
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setPromoOpen((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none",
                    padding: 0, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 11,
                    letterSpacing: 1.5, textTransform: "uppercase",
                    color: promoInfo ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {promoInfo ? `Промокод ${promoInfo.code} · −${discount} грн` : "У мене є промокод"}
                  <span aria-hidden style={{ fontSize: 11, transition: "transform 0.2s", transform: promoOpen ? "rotate(180deg)" : "none" }}>▾</span>
                </button>

                {promoOpen && (
                <div style={{ marginTop: 10 }}>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="Промокод"
                    value={promo}
                    maxLength={MAX_PROMO}
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
                )}
              </div>
              <textarea className="form-input" placeholder="Коментар до замовлення" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={MAX_COMMENT} style={{ minHeight: 80 }} />
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

      {pickerOpen && (
        <PickupPicker
          delivery={delivery}
          date={pickupDate}
          time={pickupTime}
          hours={contacts.hours}
          onApply={(d, t) => { setPickupDate(d); setPickupTime(t); setPickupChosen(true); setPickupMsg(""); setError(""); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/** Кількість наборів приборів: за замовчуванням рахується від суми, можна змінити. */
function CutleryRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <span style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>
          Прибори
        </span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.75 }}>палички та серветки</span>
      </div>

      <div ref={ref} style={{ position: "relative", width: 108, flexShrink: 0 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "12px 14px", cursor: "pointer", background: "var(--bg-card)",
            border: `1px solid ${open ? "var(--accent)" : "var(--border-light)"}`,
            color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 300,
          }}>
          {value} шт
          <span aria-hidden style={{ color: "var(--text-secondary)", fontSize: 11, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </button>

        {open && (
          <div role="listbox"
            style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", width: "100%", zIndex: 10,
              background: "var(--bg-card)", border: "1px solid var(--border-light)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.55)", padding: 4,
            }}>
            {Array.from({ length: CUTLERY_MAX }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="option" aria-selected={n === value}
                onClick={() => { onChange(n); setOpen(false); }}
                style={{
                  width: "100%", padding: "9px 10px", textAlign: "left", cursor: "pointer",
                  background: "transparent", border: "none", fontFamily: "var(--font-body)", fontSize: 13,
                  color: n === value ? "var(--accent)" : "var(--text-primary)",
                }}>
                {n} шт
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Повідомлення: частину товарів прибрано з кошика, бо їх більше немає в меню. */
function RemovedNotice({ onClose }: { onClose: () => void }) {
  return (
    <div role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, margin: "12px 0 4px", padding: "10px 12px",
        border: "1px solid var(--border-light)", background: "var(--bg-elevated)",
        fontSize: 12, lineHeight: 1.5, color: "var(--text-primary)",
      }}>
      <span style={{ flex: 1 }}>Деякі товари більше недоступні й прибрані з кошика.</span>
      <button type="button" onClick={onClose} aria-label="Закрити повідомлення"
        style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
}

/** Рядок «коли забрати / доставити»: дата + час, обидві кнопки відкривають той самий пікер. */
function PickupRow({ delivery, date, time, hours, message, onOpen }: { delivery: Delivery; date: string; time: string; hours: string; message: string; onOpen: () => void }) {
  const dayLabel = dayOptions(hours).find((d) => d.value === date)?.label ?? weekdayLabel(date);
  return (
    <div>
      <span style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
        {delivery === "delivery" ? "Коли доставити" : "Коли забрати"}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <PickupButton label={dayLabel} onClick={onOpen} />
        <PickupButton label={time || (delivery === "delivery" ? "Якнайшвидше" : "По готовності")} onClick={onOpen} accent={!!time} />
      </div>
      {message && <p style={{ fontSize: 11, color: "#E0726A", marginTop: 6, lineHeight: 1.5 }}>{message}</p>}
    </div>
  );
}

function PickupButton({ label, onClick, accent = false }: { label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "14px 14px", cursor: "pointer", textAlign: "left",
        background: "var(--bg-card)", border: "1px solid var(--border-light)",
        color: accent ? "var(--accent)" : "var(--text-primary)",
        fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 300,
      }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span aria-hidden style={{ flexShrink: 0, color: "var(--text-secondary)", fontSize: 11 }}>▾</span>
    </button>
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
