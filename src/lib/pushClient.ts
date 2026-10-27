"use client";

import { isIos, isStandalone } from "@/lib/pwa";

// Пуш-сповіщення — клієнтська частина для двох застосунків на одному домені:
//   "admin" — «SS Адмінка» (scope /admin, сервер /api/admin/push): замовлення й оновлення для персоналу;
//   "shop"  — сайт (scope /, сервер /api/push): статус замовлення й акції для клієнтів.
// Service worker один (/sw.js), реєстрації — окремі за scope. iPhone/iPad: лише в установленому
// застосунку (iOS 16.4+), дозвіл — лише по натисканню кнопки.

export type PushState =
  | "unsupported"   // браузер не вміє Web Push
  | "install-first" // iPhone/iPad у вкладці Safari — спершу «На екран „Додому“»
  | "denied"        // заборонено в налаштуваннях пристрою
  | "off"           // можна увімкнути
  | "on";           // цей пристрій підписаний

export type PushApp = "admin" | "shop";

const SW_URL = "/sw.js";
const APPS: Record<PushApp, { scope: string; api: string }> = {
  admin: { scope: "/admin", api: "/api/admin/push" },
  shop: { scope: "/", api: "/api/push" },
};
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushAvailable = () => VAPID_PUBLIC.length > 0;

/** Реєстрація service worker адмінки (без нього лише немає сповіщень). Виклик — при старті адмінки. */
export function registerAdminServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(SW_URL, { scope: APPS.admin.scope }).catch(() => { /* без SW адмінка працює */ });
  listenOpenMessages();
}

let listening = false;
/** Тап по сповіщенню, якщо SW не зміг сам перевести вікно. */
export function listenOpenMessages() {
  if (listening || !("serviceWorker" in navigator)) return;
  listening = true;
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "open" && typeof e.data.url === "string") window.location.assign(e.data.url);
  });
}

/** Саме реєстрація цього застосунку: getRegistration("/admin") повернула б і реєстрацію сайту (scope / ширший). */
async function registration(app: PushApp) {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.find((r) => new URL(r.scope).pathname.replace(/\/$/, "") === APPS[app].scope.replace(/\/$/, ""));
}

export async function currentSubscription(app: PushApp = "admin") {
  if (!("serviceWorker" in navigator)) return null;
  return (await (await registration(app))?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(app: PushApp = "admin"): Promise<PushState> {
  if (isIos() && !isStandalone()) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription(app);
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushApi<T = Record<string, unknown>>(app: PushApp, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(APPS[app].api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

/** Увімкнути на цьому пристрої. Викликати лише з натискання кнопки (вимога iOS). `extra` — налаштування (сайт). */
export async function enablePush(app: PushApp = "admin", extra: Record<string, unknown> = {}): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = (await registration(app)) ?? (await navigator.serviceWorker.register(SW_URL, { scope: APPS[app].scope }));
  listenOpenMessages();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) }));
  await pushApi(app, { action: "subscribe", subscription: sub.toJSON(), ...extra });
  return "on";
}

export async function disablePush(app: PushApp = "admin"): Promise<PushState> {
  const sub = await currentSubscription(app);
  if (sub) {
    await pushApi(app, { action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

export async function sendTestPush(app: PushApp = "admin") {
  const sub = await currentSubscription(app);
  if (!sub) throw new Error("not_subscribed");
  await pushApi(app, { action: "test", endpoint: sub.endpoint });
}

/** Число нових замовлень на іконці застосунку (де підтримується). */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
}

/**
 * Позначити переглянуте ({ orders } — відкрив дошку, { version } — відкрив «Що нового», {} — лише
 * прочитати) і оновити число на іконці застосунку. Помилки мовчки ігноруємо.
 */
export async function syncSeen(what: { orders?: true; version?: true } = {}) {
  try {
    const res = await fetch("/api/admin/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(what),
    });
    const data = (await res.json()) as { ok?: boolean; badge?: number };
    if (data.ok && typeof data.badge === "number") setAppBadge(data.badge);
  } catch { /* офлайн / розлогінений — число лишається як було */ }
}
