"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { createClient } from "@/lib/supabase/client";
import {
  disablePush, enablePush, getPushState, pushAvailable, registerAdminServiceWorker, sendTestPush, setAppBadge, type PushState,
} from "@/lib/pushClient";
import s from "./admin.module.css";

/** При старті адмінки: service worker для сповіщень + число нових замовлень на іконці застосунку. */
export function AdminPwaBoot() {
  useEffect(() => {
    registerAdminServiceWorker();
    const supabase = createClient();
    const syncBadge = async () => {
      if (document.visibilityState !== "visible") return;
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
      if (typeof count === "number") setAppBadge(count);
    };
    void syncBadge();
    document.addEventListener("visibilitychange", syncBadge);
    return () => document.removeEventListener("visibilitychange", syncBadge);
  }, []);
  return null;
}

const STATE_TEXT: Record<PushState, string> = {
  "install-first":
    "На iPhone сповіщення працюють лише в застосунку. У Safari натисніть «Поділитися» → «На екран „Додому“», відкрийте «SS Адмінка» з екрана телефону і ввімкніть сповіщення тут.",
  unsupported: "Цей браузер не підтримує сповіщення. Спробуйте Chrome або застосунок «SS Адмінка» на iPhone.",
  denied: "Сповіщення заборонені в налаштуваннях телефону. Увімкніть їх: Налаштування → Сповіщення → SS Адмінка (або налаштування сайту в браузері).",
  off: "Нове замовлення — сповіщення на цей телефон чи компʼютер, як у месенджері. Тап відкриває дошку замовлень, на іконці — кількість нових.",
  on: "Сповіщення про нові замовлення увімкнені на цьому пристрої.",
};

/** Пункт меню «Сповіщення» + вікно налаштування для цього пристрою. */
export function PushMenuItem() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => { getPushState().then(setState).catch(() => setState("unsupported")); }, []);
  useEffect(refresh, [refresh]);

  const run = async (fn: () => Promise<PushState | void>, ok?: string) => {
    setBusy(true); setMsg("");
    try {
      const next = await fn();
      if (next) setState(next);
      if (ok) setMsg(ok);
    } catch {
      setMsg("Не вдалося. Спробуйте ще раз або перезапустіть застосунок.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={s.navItem} style={{ width: "100%", textAlign: "left", background: "transparent", display: "flex", justifyContent: "space-between" }}
        onClick={() => { refresh(); setMsg(""); setOpen(true); }}>
        Сповіщення
        {state === "on" && <span aria-label="увімкнено" title="Увімкнено">🔔</span>}
      </button>
      {open && (
        <Modal title="Сповіщення про замовлення" onClose={() => setOpen(false)}>
          {!pushAvailable() ? (
            <p>Сповіщення ще не налаштовані на сервері (ключі VAPID). Telegram працює як і раніше.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{state ? STATE_TEXT[state] : "Перевіряємо…"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {state === "off" && (
                  <button className={s.btn} disabled={busy} onClick={() => run(enablePush, "Готово! Надішліть тест, щоб перевірити.")}>
                    Увімкнути сповіщення
                  </button>
                )}
                {state === "on" && (
                  <>
                    <button className={s.btn} disabled={busy} onClick={() => run(sendTestPush, "Тест надіслано — сповіщення має зʼявитися за кілька секунд.")}>
                      Надіслати тест
                    </button>
                    <button className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => run(disablePush, "Вимкнено на цьому пристрої.")}>
                      Вимкнути
                    </button>
                  </>
                )}
              </div>
              {msg && <p style={{ margin: 0, color: "var(--text-secondary)" }}>{msg}</p>}
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                Налаштування — окремо для кожного пристрою. Telegram-повідомлення про замовлення приходять як і раніше.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
