// «Запроси друга» на клієнті: код із посилання /?ref=CODE пам'ятаємо 30 днів —
// кошик сам підставить його як промокод (−10% на перше замовлення; перевіряє сервер).

const KEY = "ss_ref";
const TTL = 30 * 24 * 60 * 60 * 1000;
export const REF_PERCENT = 10;
export const REF_POINTS = 10;

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
