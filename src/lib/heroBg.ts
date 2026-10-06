// Фонові фото головного екрана (hero): розмиття + затемнення під текстом.
// Редагується в адмінці (/admin/hero-bg), зберігається в settings (key='hero_bg').
// Кілька активних фото — плавно змінюють одне одне раз на `intervalMin` хвилин.
// Зміна привʼязана до годинника: усі відвідувачі бачать те саме фото, новий — одразу поточне.

export interface HeroPhoto {
  url: string;
  active: boolean;
  blur: number;       // розмиття, px (0–30)
  dim: number;        // затемнення, % (0–90)
  brightness: number; // яскравість, % (50–150)
  posX: number;       // фокус кадру по горизонталі, % (0–100)
  posY: number;       // фокус кадру по вертикалі, % (0–100)
}

export interface HeroBg {
  intervalMin: number; // хвилин між фото (якщо активних кілька)
  photos: HeroPhoto[];
}

export const HERO_PHOTO_DEFAULTS: Omit<HeroPhoto, "url"> = {
  active: true, blur: 6, dim: 55, brightness: 100, posX: 50, posY: 50,
};

export const DEFAULT_HERO_BG: HeroBg = { intervalMin: 5, photos: [] };

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function parseHeroBg(raw: unknown): HeroBg {
  if (!raw || typeof raw !== "object") return DEFAULT_HERO_BG;
  const r = raw as { intervalMin?: unknown; photos?: unknown };
  const d = HERO_PHOTO_DEFAULTS;
  const photos = Array.isArray(r.photos)
    ? r.photos
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof (p as { url?: unknown }).url === "string")
        .map((p) => ({
          url: String(p.url),
          active: p.active !== false,
          blur: clamp(p.blur, 0, 30, d.blur),
          dim: clamp(p.dim, 0, 90, d.dim),
          brightness: clamp(p.brightness, 50, 150, d.brightness),
          posX: clamp(p.posX, 0, 100, d.posX),
          posY: clamp(p.posY, 0, 100, d.posY),
        }))
    : [];
  return { intervalMin: Math.round(clamp(r.intervalMin, 1, 60, DEFAULT_HERO_BG.intervalMin)), photos };
}
