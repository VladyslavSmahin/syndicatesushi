"use client";

import { useEffect, useState } from "react";
import PushSwitch from "./PushSwitch";
import {
  currentSubscription, disablePush, enablePush, getPushState, pushApi, pushAvailable, sendTestPush, type PushState,
} from "@/lib/pushClient";

type Prefs = { orders: boolean; promos: boolean };

const HINT: Partial<Record<PushState, string>> = {
  "install-first": "На iPhone сповіщення працюють лише з іконки сайту: у Safari «Поділитися» → «На екран „Додому“», відкрийте сайт з екрана телефону й увімкніть тут.",
  unsupported: "Цей браузер не підтримує сповіщення.",
  denied: "Сповіщення заборонені в налаштуваннях телефону чи браузера — увімкніть їх там для нашого сайту.",
};

/** Кабінет → «Сповіщення»: статус замовлення й акції на цьому пристрої + тест. */
export default function CustomerPushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ orders: false, promos: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const st = await getPushState("shop").catch(() => "unsupported" as PushState);
      if (st === "on") {
        const sub = await currentSubscription("shop");
        const r = sub ? await pushApi<{ subscribed: boolean } & Prefs>("shop", { action: "get", endpoint: sub.endpoint }).catch(() => null) : null;
        if (r?.subscribed) { setPrefs({ orders: r.orders, promos: r.promos }); setState("on"); return; }
        setState("off"); // підписка браузера є, а на сервері — ні (інший акаунт тощо)
        return;
      }
      setState(st);
    })();
  }, []);

  if (!pushAvailable() || !state) return null;
  if (HINT[state]) return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>{HINT[state]}</p>;

  const change = async (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setBusy(true); setMsg("");
    try {
      if (!next.orders && !next.promos) {
        setState(await disablePush("shop"));
      } else if (state !== "on") {
        const st = await enablePush("shop", next);
        setState(st);
        if (st !== "on") return;
      } else {
        const sub = await currentSubscription("shop");
        if (sub) await pushApi("shop", { action: "prefs", endpoint: sub.endpoint, ...next });
      }
      setPrefs(next);
    } catch {
      setMsg("Не вдалося. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true); setMsg("");
    try { await sendTestPush("shop"); setMsg("Надіслано ✓"); }
    catch { setMsg("Не вдалося надіслати."); }
    finally { setBusy(false); }
  };

  const on = state === "on";
  const row = (key: keyof Prefs, title: string, sub: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: "var(--text-primary)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
      </div>
      <PushSwitch label={title} checked={on && prefs[key]} disabled={busy} onChange={(v) => change(key, v)} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, border: "1px solid var(--border-light)", borderRadius: 10, background: "var(--bg-card)" }}>
      {row("orders", "Статус замовлення", "Прийнято, виконано чи скасовано")}
      {row("promos", "Акції та новинки", "Не частіше кількох разів на місяць")}
      {(on || msg) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {on && <button type="button" className="btn-secondary" disabled={busy} onClick={test} style={{ padding: "8px 14px", fontSize: 12 }}>Тестове сповіщення</button>}
          {msg && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}
