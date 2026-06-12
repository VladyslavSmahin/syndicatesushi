// Глосарій — редаговані назви/підписи сутностей, які інакше захардкоджені в коді.
// Зберігається в settings (key='glossary'). Додавати нові ключі — лише сюди.

export interface GlossaryEntry {
  key: string;
  label: string;   // підпис у адмінці
  default: string; // значення за замовчуванням
  group: string;   // секція в адмінці
  hint?: string;
}

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  { key: "badge_hit", label: "Бейдж «хіт»", default: "ХІТ", group: "Бейджі", hint: "Текст плашки на товарах-хітах" },
  { key: "badge_new", label: "Бейдж «новинка»", default: "НОВЕ", group: "Бейджі", hint: "Текст плашки на новинках" },
  { key: "title_hits", label: "Заголовок блоку хітів", default: "Хіти меню", group: "Блоки головної" },
  { key: "title_full_menu", label: "Заголовок повного меню", default: "Повне меню", group: "Блоки головної" },
  { key: "nav_novynky", label: "Навігація: «новинки»", default: "Новинки", group: "Навігація", hint: "Кнопка в шапці + заголовок розділу новинок" },
  { key: "nav_aktsii", label: "Навігація: «акції»", default: "Акції", group: "Навігація" },
  { key: "cart_extras", label: "Кошик: блок «додатково»", default: "Додатково", group: "Кошик" },
];

export type Glossary = Record<string, string>;

export const GLOSSARY_DEFAULTS: Glossary = Object.fromEntries(
  GLOSSARY_ENTRIES.map((e) => [e.key, e.default])
);

/** Безпечний парс jsonb-налаштувань: дефолти + перекриття непорожніми рядками. */
export function parseGlossary(v: unknown): Glossary {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: Glossary = { ...GLOSSARY_DEFAULTS };
  for (const e of GLOSSARY_ENTRIES) {
    const val = o[e.key];
    if (typeof val === "string" && val.trim()) out[e.key] = val;
  }
  return out;
}
