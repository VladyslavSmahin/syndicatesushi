// «Приведи друга» на клієнті: код із посилання /?ref=CODE пам'ятаємо 30 днів —
// кошик сам підставить його як промокод (−10% на перше замовлення від 1500 грн; перевіряє сервер).
// Запрошувачу — сертифікат 100 грн на замовлення від 1000 грн, коли замовлення друга підтверджено.

const KEY = "ss_ref";
const TTL = 30 * 24 * 60 * 60 * 1000;
export const REF_PERCENT = 10;
export const REF_MIN_TOTAL = 1500;
export const CERT_AMOUNT = 100;
export const CERT_MIN_ORDER = 1000;

export const normRefCode = (raw: string | null | undefined) => {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
};

export function saveRef(code: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* ignore */ }
}

export function readRef(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { code?: string; at?: number } | null;
    if (!v?.code || !v.at || Date.now() - v.at > TTL) return null;
    return normRefCode(v.code);
  } catch { return null; }
}

export function clearRef() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const refLink = (code: string) => `${window.location.origin}/?ref=${code}`;
