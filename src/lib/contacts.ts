// Контакти закладу — редагуються в адмінці (/admin/contacts), зберігаються
// в settings (key='contacts'). Дефолти нижче використовуються, поки в БД пусто.

export interface ContactEntry {
  key: string;
  label: string;      // підпис у адмінці
  default: string;
  group: string;      // секція в адмінці
  hint?: string;
  placeholder?: string;
}

export const CONTACT_ENTRIES: ContactEntry[] = [
  { key: "phone", label: "Телефон", default: "068 823 40 12", group: "Основне", hint: "Показується в шапці, футері, на карті та в офертах" },
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

/** Безпечний парс jsonb: дефолти + перекриття рядками з БД (порожній рядок — валідне значення). */
export function parseContacts(v: unknown): SiteContacts {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: SiteContacts = { ...CONTACTS_DEFAULTS };
  for (const e of CONTACT_ENTRIES) {
    const raw = o[e.key];
    if (typeof raw === "string") out[e.key] = raw.trim();
  }
  return out;
}

/** «068 823 40 12» → «tel:+380688234012» (укр. номери), інше — як є, без пробілів. */
export function telHref(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("380")) return `tel:+${d}`;
  if (d.length === 10 && d.startsWith("0")) return `tel:+38${d}`;
  return `tel:${(phone || "").replace(/[^+\d]/g, "")}`;
}
