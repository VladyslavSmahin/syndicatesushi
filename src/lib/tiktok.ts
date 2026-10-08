// Блок «Ми в TikTok» на головній (під відгуками). Редагується в адмінці (/admin/tiktok),
// зберігається в settings (key='tiktok'). Обкладинку при додаванні копіюємо в R2:
// посилання TikTok на обкладинку підписане й живе ~добу, тож брати його напряму не можна.

export interface TikTokVideo {
  id: string;     // числовий id ролика (з URL …/video/<id>)
  url: string;    // канонічне посилання на ролик
  title: string;  // підпис ролика (з oEmbed)
  thumb: string;  // обкладинка в нашому R2 (9:16)
  plays?: number; // перегляди (лише в режимі auto)
}

export interface TikTokBlock {
  enabled: boolean;
  profileUrl: string; // посилання на акаунт — віджет профілю й кнопка «Дивитись усі»
  /** auto — останні ролики акаунта підтягує сервер сам (стрічка в стилі сайту, відео грає в модалці);
   *  widget — офіційний віджет профілю TikTok (світла картка, тап веде в TikTok);
   *  videos — стрічка з роликів, вибраних вручну */
  mode: "auto" | "widget" | "videos";
  videos: TikTokVideo[];       // ручні ролики (mode=videos)
  autoVideos: TikTokVideo[];   // підтягнуті автоматично (mode=auto)
  syncedAt: string | null;     // остання вдала синхронізація (ISO)
}

export const DEFAULT_TIKTOK: TikTokBlock = { enabled: false, profileUrl: "", mode: "auto", videos: [], autoVideos: [], syncedAt: null };

/** нікнейм з посилання на акаунт: https://www.tiktok.com/@sushi.syndicate_t → sushi.syndicate_t */
export function tiktokUsername(profileUrl: string): string | null {
  const m = profileUrl.match(/tiktok\.com\/@([A-Za-z0-9._]{2,24})/);
  return m ? m[1] : null;
}

/** id ролика з повного посилання (tiktok.com/@user/video/123…, а також /embed/v2/123, /player/v1/123). */
export function tiktokVideoId(url: string): string | null {
  const m = url.match(/tiktok\.com\/(?:@[^/?#]+\/video|embed(?:\/v2)?|player\/v1|v)\/(\d{8,25})/i);
  return m ? m[1] : null;
}

/** Плеєр TikTok для iframe (вантажимо лише по тапу — щоб не гальмувати головну). */
export const tiktokPlayerUrl = (id: string) =>
  `https://www.tiktok.com/player/v1/${id}?autoplay=1&music_info=1&description=1&rel=0&native_context_menu=0`;

const parseVideos = (raw: unknown): TikTokVideo[] =>
  Array.isArray(raw)
    ? raw
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .map((v) => ({
          id: String(v.id ?? ""), url: String(v.url ?? ""), title: String(v.title ?? ""), thumb: String(v.thumb ?? ""),
          ...(Number.isFinite(Number(v.plays)) && v.plays != null ? { plays: Number(v.plays) } : null),
        }))
        .filter((v) => /^\d{8,25}$/.test(v.id) && /^https:\/\//.test(v.thumb))
    : [];

export function parseTikTok(raw: unknown): TikTokBlock {
  if (!raw || typeof raw !== "object") return DEFAULT_TIKTOK;
  const r = raw as { enabled?: unknown; profileUrl?: unknown; videos?: unknown; autoVideos?: unknown; syncedAt?: unknown };
  const videos = parseVideos(r.videos);
  const autoVideos = parseVideos(r.autoVideos);
  const syncedAt = typeof r.syncedAt === "string" ? r.syncedAt : null;
  const user = typeof r.profileUrl === "string" ? tiktokUsername(r.profileUrl) : null;
  const profileUrl = user ? `https://www.tiktok.com/@${user}` : "";
  const rawMode = (raw as { mode?: unknown }).mode;
  const mode = rawMode === "videos" || rawMode === "widget" ? rawMode : "auto";
  // показувати є що: віджет/авто — досить акаунта (авто без роликів показує віджет); ручна стрічка — потрібні ролики
  const hasContent = mode === "videos" ? videos.length > 0 : !!user;
  return { enabled: r.enabled !== false && hasContent, profileUrl, mode, videos, autoVideos, syncedAt };
}
