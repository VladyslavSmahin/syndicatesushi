import "server-only";

// Концепція програми лояльності для /admin/loyalty. Лише сервер: тут фінанси бізнесу, у клієнтський бандл
// не потрапляє — сторінка віддає пункти тільки адміну. Джерело — docs/business/loyalty-concept-v0.1.html
// і BUSINESS.md. `key` пункту — прив'язка коментарів (таблиця loyalty_comments): не перейменовувати.
//
// kind — як показати пункт: kpi — плитка з великим числом, level — сходинка рівня (amount — поріг),
// step — крок місячної механіки, row — рядок списку. Сусідні пункти одного kind ідуть однією сіткою.

export type LoyaltyTag = "власники" | "перевірено" | "підтвердити" | "гіпотеза";
export type LoyaltyItem = {
  key: string;
  kind: "kpi" | "level" | "step" | "row";
  title: string;
  value?: string;
  amount?: number;
  text?: string;
  tag?: LoyaltyTag;
  bars?: { label: string; value: number; caption: string }[];
};
export type LoyaltySection = { key: string; title: string; note?: string; items: LoyaltyItem[] };

/** Чек для оцінки «скільки замовлень до рівня» — орієнтир власників */
export const LOYALTY_CHECK = 1000;

export const LOYALTY_SECTIONS: LoyaltySection[] = [
  {
    key: "numbers",
    title: "Показники",
    items: [
      { key: "numbers.turnover", kind: "kpi", title: "Оборот / міс", value: "~500 000 ₴", tag: "власники" },
      { key: "numbers.orders", kind: "kpi", title: "Замовлень / міс", value: "500+", tag: "власники" },
      { key: "numbers.check", kind: "kpi", title: "Середній чек", value: "950–1 000 ₴", tag: "власники" },
      { key: "numbers.check-site", kind: "kpi", title: "Середній чек на сайті", value: "1 051 ₴", text: "медіана 965 ₴ · 117 замовлень, 12.06–06.11", tag: "перевірено" },
      { key: "numbers.profit", kind: "kpi", title: "Чистий прибуток", value: "17–20%", text: "~85–100 тис ₴ / міс", tag: "власники" },
      { key: "numbers.repeat", kind: "kpi", title: "Повертаються", value: "~60%", text: "постійний — 2–3 замовлення / міс", tag: "власники" },
      { key: "numbers.promo", kind: "kpi", title: "Акційних замовлень", value: "15–20%", tag: "власники" },
      { key: "numbers.sets", kind: "kpi", title: "Собівартість сетів", value: "~80%", text: "маржа ~20% до інших витрат", tag: "власники" },
      { key: "numbers.premium", kind: "kpi", title: "Преміальний рол", value: "350 → 500 ₴", text: "собівартість → ціна", tag: "власники" },
      { key: "numbers.packing", kind: "kpi", title: "Пакування", value: "~50 ₴", text: "на замовлення", tag: "власники" },
      { key: "numbers.courier", kind: "kpi", title: "Кур'єр", value: "30–50 ₴", text: "чи покриває його доставка — з'ясувати", tag: "власники" },
      { key: "numbers.statuses", kind: "kpi", title: "У статусі «new»", value: "116 / 120", text: "оплачені замовлення поки не відрізнити", tag: "перевірено" },
    ],
  },
  {
    key: "levels",
    title: "Постійні досягнення",
    note: "За оплаченим оборотом через сайт, назавжди. Подарунок — до наступного замовлення. Нагороди мають рости, без повторів на сусідніх рівнях.",
    items: [
      { key: "levels.beginner", kind: "level", title: "Початківець", amount: 2000, text: "Невеликий подарунок" },
      { key: "levels.bronze", kind: "level", title: "Бронза", amount: 5000, text: "Напій або додаткова позиція" },
      { key: "levels.silver", kind: "level", title: "Срібло", amount: 10000, text: "Звичайний рол" },
      { key: "levels.gold", kind: "level", title: "Золото", amount: 20000, text: "Преміальний рол · собівартість від 350 ₴" },
      { key: "levels.platinum", kind: "level", title: "Платина", amount: 35000, text: "«Суші-комплімент»: 2 гункани, 2 суші, соус · ~100–130 ₴", tag: "гіпотеза" },
      { key: "levels.diamond", kind: "level", title: "Діамант", amount: 50000, text: "Спецпропозиція або сертифікат з мін. сумою" },
      { key: "levels.vip", kind: "level", title: "VIP", amount: 80000, text: "Статус, підтвердження раз на 12 міс" },
    ],
  },
  {
    key: "vip",
    title: "VIP-статус",
    items: [
      { key: "vip.threshold", kind: "kpi", title: "Поріг", value: "80 000 ₴", text: "за останні 12 місяців", tag: "підтвердити" },
      { key: "vip.confirm", kind: "kpi", title: "Підтвердження", value: "12 міс", text: "не виконано — VIP знімається, рівні лишаються" },
      {
        key: "vip.compare",
        kind: "kpi",
        title: "Замовлень на місяць для порогу",
        text: "при чеку 950 ₴",
        bars: [
          { label: "30 000 ₴", value: 2.6, caption: "2,6" },
          { label: "50 000 ₴", value: 4.4, caption: "4,4" },
          { label: "80 000 ₴", value: 7, caption: "7" },
        ],
      },
      { key: "vip.perks", kind: "row", title: "Привілеї", text: "День народження, періодичні подарунки, закриті пропозиції. Без великої постійної знижки." },
    ],
  },
  {
    key: "monthly",
    title: "Повторні замовлення за місяць",
    note: "Лічильник обнуляється 1-го числа. Рахуються окремі оплачені замовлення.",
    items: [
      { key: "monthly.1-2", kind: "step", title: "1–2", text: "Лише прогрес" },
      { key: "monthly.3", kind: "step", title: "3", text: "Невеликий подарунок" },
      { key: "monthly.4", kind: "step", title: "4", text: "Цінніший подарунок" },
      { key: "monthly.5", kind: "step", title: "5", text: "Набір подарунків · у v0.1 немає", tag: "підтвердити" },
      {
        key: "monthly.small-checks",
        kind: "row",
        title: "Невеликий чек — подарунки того ж рівня",
        text: "Окремого «дешевшого» набору немає. Потрібен захист від дроблення: мін. сума замовлення в лічильнику або одне на день. Гілка «за сумою» (500 ₴ / 1 800 / 2 700 ₴) — прибрати або бонус зверху.",
        tag: "підтвердити",
      },
      { key: "monthly.one-reward", kind: "row", title: "Одна нагорода за місяць", text: "За максимальним досягнутим кроком, без сумування.", tag: "підтвердити" },
      { key: "monthly.stage", kind: "row", title: "Запуск", text: "У v0.1 — другим етапом після базової програми.", tag: "підтвердити" },
    ],
  },
  {
    key: "rules",
    title: "Правила",
    items: [
      { key: "rules.channel", kind: "row", title: "Хто бере участь", text: "Замовлення через сайт після реєстрації; клієнт — за номером телефону." },
      { key: "rules.progress", kind: "row", title: "Що йде в прогрес", text: "Сплачена вартість товарів. Без доставки, скасованих, подарунків і безкоштовних позицій." },
      { key: "rules.rewards", kind: "row", title: "Термін нагороди", text: "2 місяці; статуси: доступна / використана / прострочена.", tag: "підтвердити" },
      { key: "rules.stacking", kind: "row", title: "Не сумується", text: "Нагороди, промокоди, сертифікати, знижки й акції — одна пропозиція на замовлення." },
    ],
  },
  {
    key: "extra",
    title: "Додаткові механіки",
    items: [
      { key: "extra.signup", kind: "row", title: "Реєстрація", text: "Невеликий бонус." },
      { key: "extra.first-order", kind: "row", title: "Перше замовлення", text: "Невеликий подарунок, не дорогий." },
      { key: "extra.birthday", kind: "row", title: "День народження", text: "У концепції — для VIP; в ідеях — −10% кожному.", tag: "підтвердити" },
      { key: "extra.review", kind: "row", title: "Відгук", text: "Невеликий бонус, раз за відгук." },
      { key: "extra.site", kind: "row", title: "Замовлення через сайт", text: "Окрема мотивація замість Instagram і телефону." },
      { key: "extra.referral", kind: "row", title: "Запроси друга", text: "Не пріоритет." },
    ],
  },
  {
    key: "staff",
    title: "Персонал",
    items: [
      { key: "staff.count", kind: "kpi", title: "Працівників", value: "7", text: "окремо в статистиці" },
      { key: "staff.discount", kind: "kpi", title: "Знижка", value: "15%", text: "звичайне меню, без акцій і сумування" },
      { key: "staff.loyalty", kind: "kpi", title: "Режим STAFF", value: "50%", text: "суми йде в прогрес", tag: "гіпотеза" },
      { key: "staff.sets", kind: "row", title: "Ризик на сетах", text: "Собівартість ~80% — знижка 15% майже з'їдає маржу. Модель (знижка / програма / вибір) — погодити." },
    ],
  },
  {
    key: "todo",
    title: "До запуску",
    items: [
      { key: "todo.costs", kind: "row", title: "Собівартість кожного подарунка" },
      { key: "todo.margins", kind: "row", title: "Валовий прибуток: роли, сети, преміум; реальна доставка" },
      { key: "todo.budget", kind: "row", title: "Бюджет програми на місяць" },
      { key: "todo.thresholds", kind: "row", title: "Пороги рівнів і VIP на реальних даних" },
      { key: "todo.statuses", kind: "row", title: "Закривати замовлення у «виконано»" },
      { key: "todo.abuse", kind: "row", title: "Захист від зловживань" },
    ],
  },
];
