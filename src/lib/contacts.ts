// Контакти закладу — редагуються в адмінці (/admin/contacts), зберігаються
// в settings (key='contacts'). Дефолти нижче використовуються, поки в БД пусто.

export interface ContactEntry {
  key: string;
  label: string;      // підпис у адмінці
  default: string;
  group: string;      // секція в адмінці
  hint?: string;
  placeholder?: string;
  /** ключ прапорця «показувати на сайті» ("1"/"0") для необов'язкових телефонів */
  visibleKey?: string;
  /** службовий прапорець — окремим полем в адмінці не показується */
  flag?: boolean;
}

export const CONTACT_ENTRIES: ContactEntry[] = [
  { key: "phone", label: "Основний телефон", default: "068 823 40 12", group: "Телефони", hint: "Показується завжди: шапка, футер, мобільне меню, блок з картою, оферта" },
  { key: "phone2", label: "Телефон 2", default: "", group: "Телефони", placeholder: "Необов'язково", visibleKey: "phone2Visible" },
  { key: "phone2Visible", label: "", default: "1", group: "Телефони", flag: true },
  { key: "phone3", label: "Телефон 3", default: "", group: "Телефони", placeholder: "Необов'язково", visibleKey: "phone3Visible" },
  { key: "phone3Visible", label: "", default: "1", group: "Телефони", flag: true },
  { key: "hours", label: "Години роботи", default: "11:00 — 22:00", group: "Основне" },
  { key: "address", label: "Адреса", default: "вул. Незалежності, 7, м. Тульчин", group: "Основне" },
  { key: "addressShort", label: "Короткий підпис у Hero", default: "Тульчин · Доставка та самовивіз", group: "Основне", hint: "Рядок над великим заголовком на головній" },
  { key: "mapQuery", label: "Запит для Google-карти", default: "вул. Незалежності, 7, Тульчин, Вінницька область, Україна", group: "Основне", hint: "Адреса так, як її знаходить Google Maps" },
  { key: "instagram", label: "Instagram", default: "", group: "Соцмережі", placeholder: "https://instagram.com/…", hint: "Порожньо = іконка не показується" },
  { key: "telegram", label: "Telegram", default: "", group: "Соцмережі", placeholder: "https://t.me/…", hint: "Порожньо = іконка не показується" },
  { key: "facebook", label: "Facebook", default: "", group: "Соцмережі", placeholder: "https://facebook.com/…", hint: "Порожньо = іконка не показується" },
];

export type SiteContacts = Record<string, string>;

export const CONTACTS_DEFAULTS: SiteContacts = Object.fromEntries(
  CONTACT_ENTRIES.map((e) => [e.key, e.default])
);

/** Ключі соцмереж: приймаємо лише https-посилання (захист від javascript: та ін. схем). */
export const SOCIAL_KEYS = ["instagram", "telegram", "facebook"] as const;

/** Порожньо або https://… — інакше посилання соцмережі невалідне. */
export function isValidSocialUrl(v: string): boolean {
  const s = v.trim();
  return s === "" || /^https:\/\/\S+$/i.test(s);
}

/** Безпечний парс jsonb: дефолти + перекриття рядками з БД (порожній рядок — валідне значення). */
export function parseContacts(v: unknown): SiteContacts {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: SiteContacts = { ...CONTACTS_DEFAULTS };
  for (const e of CONTACT_ENTRIES) {
    const raw = o[e.key];
    if (typeof raw === "string") out[e.key] = raw.trim();
  }
  for (const k of SOCIAL_KEYS) if (!isValidSocialUrl(out[k])) out[k] = "";
  return out;
}

/** Телефони, які показуємо на сайті: основний + додаткові, якщо заповнені й не приховані. */
export function sitePhones(c: SiteContacts): string[] {
  const out = [c.phone];
  for (const e of CONTACT_ENTRIES) {
    if (e.visibleKey && c[e.key]?.trim() && c[e.visibleKey] !== "0") out.push(c[e.key].trim());
  }
  // той самий номер у різному записі («068…» / «+38068…») показуємо один раз
  const seen = new Set<string>();
  return out.filter((ph) => {
    if (!ph) return false;
    const d = ph.replace(/\D/g, "").replace(/^38(?=0)/, "");
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

/** «068 823 40 12» → «tel:+380688234012» (укр. номери), інше — як є, без пробілів. */
export function telHref(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("380")) return `tel:+${d}`;
  if (d.length === 10 && d.startsWith("0")) return `tel:+38${d}`;
  return `tel:${(phone || "").replace(/[^+\d]/g, "")}`;
}
