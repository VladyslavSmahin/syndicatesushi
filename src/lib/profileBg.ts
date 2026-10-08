// Фон особистого кабінету клієнта: тема (готова картинка) або своє фото.
// Кадр налаштовується окремо для телефона й компʼютера (як фон головної в адмінці).
// Зберігається в customers.profile_bg; пише лише сервер (/api/profile-bg).

export interface BgFrame {
  blur: number;  // розмиття, px (0–30)
  dim: number;   // затемнення, % (0–90)
  posX: number;  // фокус кадру по горизонталі, % (0–100)
  posY: number;  // фокус кадру по вертикалі, % (0–100)
  zoom: number;  // наближення, % (100–200)
}

export interface ProfileBg {
  /** id теми-картинки (напр. "sushi-1") або URL свого фото в нашому R2 */
  src: string;
  mobile: BgFrame;
  desktop: BgFrame;
}

export interface ThemeImage { id: string; url: string; credit: string; source: string }
export interface ProfileTheme { id: string; label: string; emoji: string; images: ThemeImage[] }

/** Готові теми. Картинки — у /public/profile-bg (Unsplash License: безкоштовно, і на комерційному сайті; автор — у credit). */
const img = (id: string, credit: string, source: string): ThemeImage => ({ id, url: `/profile-bg/${id}.webp`, credit, source });

export const PROFILE_THEMES: ProfileTheme[] = [
  { id: "sushi", label: "Суші", emoji: "🍣", images: [
    img("sushi-1", "Mahmoud Fawzy · Unsplash", "https://unsplash.com/photos/sushi-on-black-square-plate-Dbx6-XZY6Dg"),
    img("sushi-2", "René Lehmkuhl · Unsplash", "https://unsplash.com/photos/a-black-plate-topped-with-sushi-and-chopsticks-I7X53lEYVDw"),
  ] },
  { id: "japan", label: "Японія", emoji: "⛩️", images: [
    img("japan-1", "Denys Nevozhai · Unsplash", "https://unsplash.com/photos/D68ADLeMh5Q"),
    img("japan-2", "Loris Boulinguez · Unsplash", "https://unsplash.com/photos/a-red-torii-gate-frames-mount-fuji-and-lush-trees-hZU8GUT5nmw"),
  ] },
  { id: "anime", label: "Аніме", emoji: "🌸", images: [
    img("anime-1", "Julien (domsson) · Unsplash", "https://unsplash.com/photos/a-vending-machine-is-lit-up-at-night-3OyTs0T5xDA"),
    img("anime-2", "Julien (domsson) · Unsplash", "https://unsplash.com/photos/a-city-street-at-night-with-a-red-neon-sign-VlmCw-QL1R4"),
  ] },
  // теми за тайтлами: картинки додав власник сайту (profile-bg-incoming → public/profile-bg), права — у правовласників тайтлів
  ...([
    ["aot", "Атака титанів", "🗡️", 3],
    ["naruto", "Наруто", "🍥", 3],
    ["onepiece", "Ван Піс", "🏴‍☠️", 2],
    ["sololeveling", "Соло левелінг", "⚔️", 2],
    ["vinland", "Сага про Вінланд", "🛡️", 2],
    ["jjk", "Магічна битва", "👁️", 2],
  ] as const).map(([id, label, emoji, n]) => ({
    id, label, emoji,
    images: Array.from({ length: n }, (_, k) => img(`${id}-${k + 1}`, `«${label}» © правовласники`, "")),
  })),
];

/** Мініатюра теми для вибору в редакторі. */
export const thumbUrl = (i: ThemeImage) => i.url.replace(/\.webp$/, "_thumb.webp");

export const BG_FRAME_DEFAULT: BgFrame = { blur: 4, dim: 60, posX: 50, posY: 50, zoom: 100 };

export const BG_SLIDERS: { key: keyof BgFrame; label: string; min: number; max: number; unit: string }[] = [
  { key: "dim", label: "Затемнення", min: 0, max: 90, unit: "%" },
  { key: "blur", label: "Розмиття", min: 0, max: 30, unit: "px" },
  { key: "zoom", label: "Наближення", min: 100, max: 200, unit: "%" },
  { key: "posX", label: "Кадр ↔", min: 0, max: 100, unit: "%" },
  { key: "posY", label: "Кадр ↕", min: 0, max: 100, unit: "%" },
];

export const findThemeImage = (id: string): ThemeImage | undefined =>
  PROFILE_THEMES.flatMap((t) => t.images).find((i) => i.id === id);

/** Адреса картинки: тема → файл з /public; своє фото — як є. */
export const bgUrl = (src: string): string | null =>
  findThemeImage(src)?.url ?? (/^https:\/\//.test(src) ? src : null);

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

export function parseFrame(raw: unknown): BgFrame {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = BG_FRAME_DEFAULT;
  return {
    blur: clamp(r.blur, 0, 30, d.blur), dim: clamp(r.dim, 0, 90, d.dim),
    posX: clamp(r.posX, 0, 100, d.posX), posY: clamp(r.posY, 0, 100, d.posY), zoom: clamp(r.zoom, 100, 200, d.zoom),
  };
}

export function parseProfileBg(raw: unknown): ProfileBg | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { src?: unknown; mobile?: unknown; desktop?: unknown };
  if (typeof r.src !== "string" || !r.src) return null;
  return { src: r.src, mobile: parseFrame(r.mobile), desktop: parseFrame(r.desktop) };
}
