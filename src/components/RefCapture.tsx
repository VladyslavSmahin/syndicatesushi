"use client";

import { useEffect, useState } from "react";
import { normRefCode, saveRef, readRef, REF_PERCENT, REF_MIN_TOTAL } from "@/lib/referral";
import { createClient } from "@/lib/supabase/client";

/** Прийшли за посиланням друга (?ref=CODE): запам'ятовуємо код, прибираємо його з адреси й коротко пояснюємо, що знижка вже чекає в кошику.
 *  Коли людина входить / реєструється — привʼязуємо її до того, хто запросив (статус «зареєструвався» у кабінеті друга). */
export default function RefCapture() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => bindReferrer(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_IN") bindReferrer(session?.user.id); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = normRefCode(url.searchParams.get("ref"));
    if (!url.searchParams.has("ref")) return;
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!code) return;
    saveRef(code);
    setShow(true);
    // посилання могли відкрити вже залогіненим — привʼяжемо одразу
    createClient().auth.getSession().then(({ data }) => bindReferrer(data.session?.user.id));
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 9000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="acc-promo ref-toast" role="status">
      <span className="acc-promo-gift" aria-hidden>🎁</span>
      <div>
        <b>Вас запросив друг!</b>
        <span>−{REF_PERCENT}% на перше замовлення від {REF_MIN_TOTAL} грн. Знижка сама зʼявиться в кошику.</span>
      </div>
      <button type="button" className="acc-promo-x" aria-label="Закрити" onClick={() => setShow(false)}>×</button>
    </div>
  );
}

/** Привʼязати залогіненого клієнта до того, хто запросив (один раз на акаунт; сервер перевіряє, що це новий клієнт). */
async function bindReferrer(uid: string | undefined) {
  const code = readRef();
  if (!uid || !code) return;
  const key = `ss_ref_bound:${uid}`;
  try { if (localStorage.getItem(key)) return; } catch { /* ignore */ }
  const supabase = createClient();
  await supabase.rpc("customer_ensure"); // профіль міг ще не створитися (перший вхід)
  const { data, error } = await supabase.rpc("customer_set_referrer", { code });
  // 'unauthorized' / помилка (міграції ще немає) — спробуємо наступного разу; решта відповідей остаточні
  if (!error && data && data !== "unauthorized") { try { localStorage.setItem(key, String(data)); } catch { /* ignore */ } }
}
