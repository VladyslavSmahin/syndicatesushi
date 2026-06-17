"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import s from "@/components/admin/admin.module.css";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // прапор ?denied=1 ставить middleware, коли акаунт залогінений, але не у білому списку
  useEffect(() => {
    setDenied(new URLSearchParams(window.location.search).get("denied") === "1");
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    });
    if (error) { setError("Не вдалося почати вхід. Спробуйте ще раз."); setBusy(false); }
    // інакше браузер перейде на сторінку Google
  };

  // вхід за email+паролем (альтернатива Google). Сесія кладеться в cookie,
  // далі middleware пускає в /admin, якщо профіль є (email у білому списку).
  const signInPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setError("Невірний email або пароль.");
      setBusy(false);
      return;
    }
    window.location.href = "/admin";
  };

  // вийти з поточного (не-staff) акаунта, щоб увійти іншим
  const signOut = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <div className={s.login}>
      <div className={s.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-fish.png" alt="" style={{ height: 56, marginBottom: 18 }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "var(--text-primary)" }}>
          SUSHI SYNDICATE
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 28 }}>
          Адмінпанель
        </div>

        {denied && (
          <div className={s.error} style={{ marginBottom: 18, padding: "12px 14px", border: "1px solid #5c2b2b", borderRadius: 8, lineHeight: 1.5, textAlign: "center" }}>
            <b>Доступ заборонено.</b><br />
            Цей акаунт не входить у білий список співробітників. Увійдіть робочим акаунтом
            або зверніться до адміністратора, щоб вас додали.
          </div>
        )}

        <button className={s.googleBtn} onClick={signIn} disabled={busy}>
          <GoogleIcon />
          {busy ? "Перенаправлення…" : denied ? "Спробувати іншим Google" : "Увійти через Google"}
        </button>

        <div className={s.loginDivider}><span>або</span></div>

        <form onSubmit={signInPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className={s.input}
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
          />
          <input
            className={s.input}
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
          />
          <button className={s.btn} type="submit" disabled={busy || !email.trim() || !password} style={{ width: "100%" }}>
            {busy ? "Вхід…" : "Увійти за паролем"}
          </button>
        </form>

        {denied && (
          <button className={`${s.btn} ${s.btnGhost}`} onClick={signOut} disabled={busy} style={{ marginTop: 10, width: "100%" }}>
            Вийти з поточного акаунта
          </button>
        )}

        {error && <p className={s.error} style={{ marginTop: 14 }}>{error}</p>}

        {!denied && (
          <p className={s.hint} style={{ marginTop: 22 }}>
            Доступ лише для співробітників з білого списку. Якщо ваш email не додано —
            зверніться до адміністратора.
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
