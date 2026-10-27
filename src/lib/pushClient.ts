"use client";

import { isIos, isStandalone } from "@/lib/pwa";

// Пуш-сповіщення персоналу — клієнтська частина (адмінка). Сервер — /api/admin/push.
// iPhone/iPad: лише в установленому застосунку (iOS 16.4+), дозвіл — лише по натисканню кнопки.

export type PushState =
  | "unsupported"   // браузер не вміє Web Push
  | "install-first" // iPhone/iPad у вкладці Safari — спершу «На екран „Додому“»
  | "denied"        // заборонено в налаштуваннях пристрою
  | "off"           // можна увімкнути
  | "on";           // цей пристрій підписаний

const SW_URL = "/sw.js";
const SW_SCOPE = "/admin";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushAvailable = () => VAPID_PUBLIC.length > 0;

/** Реєстрація service worker адмінки (без нього лише немає сповіщень). Виклик — при старті адмінки. */
export function registerAdminServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => { /* без SW адмінка працює */ });
  // тап по сповіщенню, якщо SW не зміг сам перевести вікно
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "open" && typeof e.data.url === "string") window.location.assign(e.data.url);
  });
}

async function registration() {
  return navigator.serviceWorker.getRegistration(SW_SCOPE);
}

export async function getPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Увімкнути на цьому пристрої. Викликати лише з натискання кнопки (вимога iOS). */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = (await registration()) ?? (await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }));
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) }));
  await api({ action: "subscribe", subscription: sub.toJSON() });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) {
    await api({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

export async function sendTestPush() {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) throw new Error("not_subscribed");
  await api({ action: "test", endpoint: sub.endpoint });
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
