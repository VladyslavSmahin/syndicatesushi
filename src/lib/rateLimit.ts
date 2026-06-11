// Простий in-memory rate-limit (ковзне вікно по ключу/IP).
// Зберігає стан у памʼяті інстансу. На Vercel працює в межах теплого інстансу —
// для невеликого трафіку гасить спам-сплески. Для розподіленого ліміту — Upstash Redis.

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  // зрідка прибираємо старі ключі, щоб мапа не росла нескінченно
  if (now - lastSweep < 60_000 && buckets.size < 5000) return;
  lastSweep = now;
  for (const [k, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length) buckets.set(k, fresh);
    else buckets.delete(k);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now, windowMs);
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfter: 0 };
}

/** IP клієнта з заголовків (Vercel виставляє x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
