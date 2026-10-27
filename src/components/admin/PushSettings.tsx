"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Modal from "./Modal";
import PushSwitch from "@/components/PushSwitch";
import {
  disablePush, enablePush, getPushState, pushAvailable, registerAdminServiceWorker, sendTestPush, syncSeen, type PushState,
} from "@/lib/pushClient";
import s from "./admin.module.css";

/**
 * Service worker для сповіщень + число непереглянутого на іконці застосунку. Відкрита дошка
 * замовлень = усі замовлення до цього моменту переглянуті.
 */
export function AdminPwaBoot() {
  const pathname = usePathname();
  useEffect(() => { registerAdminServiceWorker(); }, []);
  useEffect(() => {
    const onOrders = pathname.startsWith("/admin/orders");
    const sync = () => {
      if (document.visibilityState === "visible") void syncSeen(onOrders ? { orders: true } : {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [pathname]);
  return null;
}

const STATE_TEXT: Record<PushState, string> = {
  "install-first":
    "На iPhone сповіщення працюють лише в застосунку. У Safari натисніть «Поділитися» → «На екран „Додому“», відкрийте «SS Адмінка» з екрана телефону і ввімкніть сповіщення тут.",
  unsupported: "Цей браузер не підтримує сповіщення. Спробуйте Chrome або застосунок «SS Адмінка» на iPhone.",
  denied: "Сповіщення заборонені в налаштуваннях телефону. Увімкніть їх: Налаштування → Сповіщення → SS Адмінка (або налаштування сайту в браузері).",
  off: "Нове замовлення чи оновлення адмінки — сповіщення на цей телефон чи компʼютер, як у месенджері. Тап відкриває дошку замовлень або «Що нового», на іконці — кількість непереглянутого.",
  on: "Сповіщення про нові замовлення й оновлення адмінки увімкнені на цьому пристрої.",
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

const SHORT_STATE: Partial<Record<PushState, string>> = {
  "install-first": "Встановіть «SS Адмінка» на екран «Додому»",
  unsupported: "Браузер не підтримує",
  denied: "Заборонено в налаштуваннях телефону",
};

/** Компактний рядок на «Огляді»: перемикач сповіщень цього пристрою + «Тест». */
export function PushQuickRow() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { getPushState().then(setState).catch(() => setState("unsupported")); }, []);
  if (!pushAvailable() || !state) return null;

  const toggle = async (on: boolean) => {
    setBusy(true); setMsg("");
    try { setState(on ? await enablePush() : await disablePush()); }
    catch { setMsg("Не вдалося"); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg("");
    try { await sendTestPush(); setMsg("Надіслано ✓"); }
    catch { setMsg("Не вдалося"); }
    finally { setBusy(false); }
  };

  return (
    <div className={s.card} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap" }}>
      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>🔔 Сповіщення</span>
      <span className={s.hint} style={{ fontSize: 12, flex: "1 1 auto", minWidth: 0 }}>
        {msg || SHORT_STATE[state] || (state === "on" ? "замовлення й оновлення" : "вимкнено на цьому пристрої")}
      </span>
      {state === "on" && (
        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} disabled={busy} onClick={test}>Тест</button>
      )}
      {(state === "on" || state === "off") && (
        <PushSwitch label="Сповіщення на цьому пристрої" checked={state === "on"} disabled={busy} onChange={toggle} />
      )}
    </div>
  );
}
