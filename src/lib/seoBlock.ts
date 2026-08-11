// Текстовий SEO-блок унизу головної: заголовок, опис і питання-відповіді.
// Редагується в адмінці (/admin/seo-text), зберігається в settings (key='seo_block').
// FAQ додатково віддається Google як розмітка FAQPage.

export interface FaqItem { q: string; a: string }

export interface SeoBlock {
  enabled: boolean;
  title: string;
  text: string;      // абзаци розділяються порожнім рядком
  faq: FaqItem[];
}

export const DEFAULT_SEO_BLOCK: SeoBlock = {
  enabled: true,
  title: "Доставка суші та ролів у Тульчині",
  text:
    `Sushi Syndicate — доставка суші, ролів і сетів у Тульчині. Ми не тримаємо готові страви на вітрині: ` +
    `кожне замовлення починають готувати після дзвінка чи оформлення на сайті, тому роли приїжджають свіжими, ` +
    `а не полежалими.\n\n` +
    `У меню — класичні та запечені роли, філадельфії, сети на компанію, суші-бургери, HOT/WOK, боули, темпура ` +
    `й дитячі позиції. Для кожної страви вказані вага, склад і калорійність, тож ви бачите, за що платите.\n\n` +
    `Працюємо щодня, доставляємо по Тульчину та найближчих селах. Можна забрати самовивозом — так замовлення ` +
    `буде готове швидше. Оплата готівкою або переказом, є промокоди на постійні замовлення.`,
  faq: [
    {
      q: "Скільки часу займає доставка суші в Тульчині?",
      a: "Зазвичай 40–60 хвилин залежно від завантаженості кухні та адреси. Точний час менеджер підтверджує під час дзвінка після оформлення замовлення.",
    },
    {
      q: "Скільки коштує доставка?",
      a: "Вартість доставки залежить від відстані й розраховується менеджером при підтвердженні замовлення. Самовивіз — безкоштовно.",
    },
    {
      q: "Як оформити замовлення?",
      a: "Оберіть страви в меню на сайті, додайте їх у кошик і залиште номер телефону — ми передзвонимо для підтвердження. Також можна замовити дзвінком.",
    },
    {
      q: "Чи є самовивіз?",
      a: "Так. Оберіть «Самовивіз» під час оформлення — заберете замовлення за адресою закладу, без вартості доставки.",
    },
  ],
};

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);

/** Безпечний парс jsonb: невідомі/зіпсовані дані → дефолти. */
export function parseSeoBlock(v: unknown): SeoBlock {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o) return DEFAULT_SEO_BLOCK;

  const rawFaq = Array.isArray(o.faq) ? o.faq : null;
  const faq: FaqItem[] = rawFaq
    ? rawFaq
        .map((it) => {
          const item = it && typeof it === "object" ? (it as Record<string, unknown>) : {};
          return { q: typeof item.q === "string" ? item.q.trim() : "", a: typeof item.a === "string" ? item.a.trim() : "" };
        })
        // порожні пари просто не показуємо — так адмін може прибрати питання
        .filter((it) => it.q && it.a)
    : DEFAULT_SEO_BLOCK.faq;

  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : true,
    title: str(o.title, DEFAULT_SEO_BLOCK.title),
    text: typeof o.text === "string" ? o.text : DEFAULT_SEO_BLOCK.text,
    faq,
  };
}
