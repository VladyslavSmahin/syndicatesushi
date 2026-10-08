"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchCustomerProfile, updateCustomerPhone, signOutCustomer } from "@/features/account";
import { formatPhone, isPhoneValid } from "@/lib/phone";
import { useScrollLock } from "@/lib/scrollLock";

/** Номер телефону в акаунті обовʼязковий. Хто зареєструвався через Google (там номера немає) —
 *  бачить це вікно на сайті, доки не вкаже номер; закрити можна лише виходом з акаунта.
 *  Номер не підтверджується (без SMS) — історію за номером, як і раніше, відкриває лише підтвердження.
 *  Не показуємо: в адмінці й співробітникам, на /auth (редірект) і /account (там свій обовʼязковий блок «Мої дані»). */
export default function PhoneRequiredModal() {
  const pathname = usePathname() ?? "";
  const skipPath = pathname.startsWith("/admin") || pathname.startsWith("/auth") || pathname.startsWith("/account");
  const [customerId, setCustomerId] = useState<string | null>(null); // є акаунт без номера
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    const p = await fetchCustomerProfile().catch(() => null);
    if (!p || p.phone?.trim()) { setCustomerId(null); return; }
    // співробітники заходять тим самим Google — їм номер у клієнтському профілі не потрібен
    const { data: staff } = await createClient().from("profiles").select("role").eq("id", p.id).maybeSingle();
    setCustomerId(staff?.role ? null : p.id);
  }, []);

  useEffect(() => {
    if (skipPath) return;
    check();
    const { data: sub } = createClient().auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") check();
    });
    return () => sub.subscription.unsubscribe();
  }, [skipPath, check]);

  const open = !skipPath && !!customerId;
  useScrollLock(open);
  if (!open) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isPhoneValid(phone)) { setError("Вкажіть номер у форматі 093 728 42 98."); return; }
    setBusy(true);
    setError("");
    const ok = await updateCustomerPhone(customerId!, phone.trim());
    setBusy(false);
    if (ok) setCustomerId(null);
    else setError("Не вдалося зберегти. Спробуйте ще раз.");
  };

  return createPortal(
    <div className="fade-in"
      style={{
        position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <form role="dialog" aria-modal="true" aria-label="Вкажіть номер телефону" className="modal-pop" onSubmit={save}
        style={{
          width: "min(420px, 100%)", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 14,
          padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 14,
        }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
          Вкажіть номер телефону
        </span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
          Щоб завершити реєстрацію. Підтверджувати номер не потрібно — за ним ми звʼязуємося щодо замовлень.
        </p>
        <input className="form-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="093 728 42 98" autoFocus
          aria-label="Номер телефону" value={phone} maxLength={30}
          onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(""); }}
          style={{ fontSize: 16 /* iOS не зумить */ }} />
        {error && <p style={{ margin: 0, fontSize: 13, color: "#E0726A" }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти"}</button>
        <button type="button" onClick={async () => { await signOutCustomer(); setCustomerId(null); }}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", textDecoration: "underline" }}>
          Вийти з акаунта
        </button>
      </form>
    </div>,
    document.body,
  );
}
