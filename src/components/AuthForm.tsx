"use client";

import { useEffect, useState } from "react";
import {
  signInCustomer, signUpCustomer, signInCustomerPassword, resendConfirmation, requestPasswordReset, signOutCustomer,
} from "@/features/account";
import { formatPhone, isPhoneValid } from "@/lib/phone";

export const MIN_PASSWORD = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthMode = "login" | "register" | "forgot";

/** Вхід / реєстрація (модалка на сайті та сторінка /account без сесії).
 *  Google — пошта вже підтверджена Google, номер клієнт додасть у кабінеті.
 *  Пошта + пароль — обовʼязкові ім'я, пошта, номер; увійти можна лише після підтвердження пошти з листа.
 *  onSignedIn — викликається після входу паролем (модалка закривається). */
export type AuthErrorCode = "auth" | "profile" | null;

const ERROR_TEXT: Record<Exclude<AuthErrorCode, null>, string> = {
  auth: "Не вдалося увійти. Якщо ви переходили за посиланням із листа — відкрийте його в цьому ж браузері або просто увійдіть з паролем.",
  profile: "Вхід виконано, але профіль не завантажився. Спробуйте пізніше або вийдіть і увійдіть іншим способом.",
};

export default function AuthForm({ errorCode = null, onSignedIn }: { errorCode?: AuthErrorCode; onSignedIn?: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (errorCode) setError(ERROR_TEXT[errorCode]);
  }, [errorCode]);
  // лист надіслано: показуємо екран «перевірте пошту» з можливістю надіслати ще раз
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  const em = email.trim().toLowerCase();
  const emailOk = EMAIL_RE.test(em);

  const switchMode = (m: AuthMode) => { setMode(m); setError(""); setUnconfirmed(false); };

  const google = async () => {
    setBusy(true);
    // реєстрація — одразу в профіль (дописати номер); вхід — повертаємось туди, де були
    const { error } = await signInCustomer(mode === "register" ? "/account" : window.location.pathname);
    if (error) { setError("Не вдалося почати вхід через Google. Спробуйте ще раз."); setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(""); setUnconfirmed(false);
    if (!emailOk) { setError("Вкажіть коректну пошту."); return; }

    if (mode === "forgot") {
      setBusy(true);
      const { error } = await requestPasswordReset(em);
      setBusy(false);
      if (error) setError("Не вдалося надіслати лист. Спробуйте пізніше.");
      else setSentTo({ email: em, kind: "reset" });
      return;
    }

    if (mode === "register") {
      if (!name.trim()) { setError("Вкажіть ім'я."); return; }
      if (!isPhoneValid(phone)) { setError("Вкажіть номер у форматі 093 728 42 98."); return; }
      if (password.length < MIN_PASSWORD) { setError(`Пароль — щонайменше ${MIN_PASSWORD} символів.`); return; }
      setBusy(true);
      const { error, needsConfirmation } = await signUpCustomer({ email: em, password, name: name.trim(), phone: phone.trim() });
      setBusy(false);
      if (error) {
        setError(/already|registered/i.test(error.message) ? "Ця пошта вже зареєстрована — увійдіть." : "Не вдалося зареєструватися. Спробуйте ще раз.");
        return;
      }
      if (needsConfirmation) setSentTo({ email: em, kind: "confirm" });
      else window.location.href = "/account"; // підтвердження пошти вимкнено в Supabase — сесія вже є, одразу в профіль
      return;
    }

    setBusy(true);
    const { error } = await signInCustomerPassword(em, password);
    setBusy(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) { setUnconfirmed(true); setError("Пошту ще не підтверджено — перейдіть за посиланням із листа."); }
      else setError("Невірна пошта або пароль.");
      return;
    }
    onSignedIn?.();
  };

  const resend = async (to: string) => {
    setBusy(true);
    const { error } = await resendConfirmation(to);
    setBusy(false);
    if (error) setError("Не вдалося надіслати лист. Спробуйте за хвилину.");
    else setResent(true);
  };

  if (sentTo) {
    return (
      <div>
        <p style={{ margin: "0 0 12px", fontSize: 16 }}>Перевірте пошту</p>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-secondary)" }}>
          Ми надіслали лист на <b style={{ color: "var(--text-primary)" }}>{sentTo.email}</b>.{" "}
          {sentTo.kind === "confirm"
            ? "Перейдіть за посиланням у листі, щоб підтвердити пошту й завершити реєстрацію."
            : "Перейдіть за посиланням у листі, щоб задати новий пароль."}
          {" "}Якщо листа немає — перевірте «Спам».
        </p>
        {error && <p style={{ color: "#E0726A", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {sentTo.kind === "confirm" && (
            <button className="btn-secondary" disabled={busy || resent} onClick={() => resend(sentTo.email)}>
              {resent ? "Надіслано ще раз" : "Надіслати ще раз"}
            </button>
          )}
          <button className="btn-secondary" onClick={() => { setSentTo(null); setResent(false); switchMode("login"); }}>До входу</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-secondary)" }}>
        Увійдіть, щоб бачити історію своїх замовлень і швидше оформлювати нові — ім&apos;я та телефон підставляться автоматично.
      </p>

      {mode !== "forgot" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["login", "Вхід"], ["register", "Реєстрація"]] as const).map(([m, l]) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: "10px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                background: mode === m ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${mode === m ? "var(--accent)" : "var(--border-light)"}`,
                color: mode === m ? "var(--accent)" : "var(--text-secondary)",
              }}>{l}</button>
          ))}
        </div>
      )}

      {/* помилка входу / профілю — тут же, у формі */}
      {errorCode === "profile" && error && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ color: "#E0726A", fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 }}>{error}</p>
          <button type="button" className="btn-secondary" style={{ width: "100%" }}
            onClick={async () => { await signOutCustomer(); setError(""); window.location.reload(); }}>
            Вийти
          </button>
        </div>
      )}

      {mode !== "forgot" && (
        <>
          <button className="btn-primary" style={{ width: "100%" }} disabled={busy} onClick={google}>
            {mode === "register" ? "Зареєструватися через Google" : "Увійти через Google"}
          </button>
          {mode === "register" && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
              Пошту підтверджує Google — лист не потрібен. Номер телефону додасте в кабінеті.
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />або поштою<span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          </div>
        </>
      )}


      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "register" && (
          <>
            <input className="form-input" placeholder="Ім'я *" value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            <input className="form-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="Телефон * (093 728 42 98)"
              value={phone} maxLength={30} onChange={(e) => setPhone(formatPhone(e.target.value))} />
          </>
        )}
        <input className="form-input" type="email" placeholder="Пошта *" value={email} maxLength={200} autoComplete="email"
          onChange={(e) => setEmail(e.target.value)} />
        {mode !== "forgot" && (
          <input className="form-input" type="password" placeholder={mode === "register" ? `Пароль * (від ${MIN_PASSWORD} символів)` : "Пароль"}
            value={password} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)} />
        )}

        {error && !(errorCode === "profile" && error === ERROR_TEXT.profile) && (
          <p style={{ color: "#E0726A", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{error}</p>
        )}
        {unconfirmed && (
          <button type="button" className="btn-secondary" disabled={busy || resent} onClick={() => resend(em)}>
            {resent ? "Лист надіслано ще раз" : "Надіслати лист ще раз"}
          </button>
        )}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Зачекайте…" : mode === "register" ? "Зареєструватися" : mode === "forgot" ? "Надіслати посилання" : "Увійти"}
        </button>
        {mode === "register" && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Після реєстрації надішлемо лист — пошту потрібно підтвердити за посиланням.
          </p>
        )}
        <button type="button" onClick={() => switchMode(mode === "forgot" ? "login" : "forgot")}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 12, textDecoration: "underline", alignSelf: "flex-start" }}>
          {mode === "forgot" ? "← Назад до входу" : "Забули пароль?"}
        </button>
      </form>
    </div>
  );
}
