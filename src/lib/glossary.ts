// Глосарій — редаговані назви/підписи сутностей, які інакше захардкоджені в коді.
// Зберігається в settings (key='glossary'). Додавати нові ключі — лише сюди.

export interface GlossaryEntry {
  key: string;
  label: string;       // підпис у адмінці
  default: string;     // значення за замовчуванням
  group: string;       // секція в адмінці
  hint?: string;
  multiline?: boolean; // textarea замість input (для довгих текстів)
}

const ABOUT_DEFAULT = `Sushi Syndicate — це команда, для якої суші не просто страва, а ремесло. Ми працюємо у Тульчині й готуємо кожне замовлення лише після його оформлення, з охолодженої риби та свіжих інгредієнтів.

Наша філософія проста: чесний склад, вивірені рецептури та подача, від якої хочеться повертатися. Ми самі обираємо постачальників, контролюємо кожен етап і не економимо на дрібницях — бо саме вони створюють смак.

Замовляйте доставку або забирайте самовивозом — і відчуйте, чому нас обирають знову і знову.`;

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  { key: "badge_hit", label: "Бейдж «хіт»", default: "ХІТ", group: "Бейджі", hint: "Текст плашки на товарах-хітах" },
  { key: "badge_new", label: "Бейдж «новинка»", default: "НОВЕ", group: "Бейджі", hint: "Текст плашки на новинках" },
  { key: "title_hits", label: "Заголовок блоку хітів", default: "Хіти меню", group: "Блоки головної" },
  { key: "title_full_menu", label: "Заголовок повного меню", default: "Повне меню", group: "Блоки головної" },
  { key: "nav_novynky", label: "Навігація: «новинки»", default: "Новинки", group: "Навігація", hint: "Кнопка в шапці + заголовок розділу новинок" },
  { key: "nav_aktsii", label: "Навігація: «акції»", default: "Акції", group: "Навігація" },
  { key: "cart_extras", label: "Кошик: блок «додатково»", default: "Додатково", group: "Кошик" },
  { key: "about_title", label: "Про нас: заголовок", default: "Про нас", group: "Про нас" },
  { key: "about_text", label: "Про нас: текст", default: ABOUT_DEFAULT, group: "Про нас", multiline: true, hint: "Абзаци розділяються порожнім рядком" },
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
