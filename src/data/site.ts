// =============================================================================
//  SUSHI SYNDICATE — ДАНІ САЙТУ (статичні, з прототипу)
// =============================================================================
//  Тимчасове джерело даних. Пізніше буде замінено на запити до Supabase.
//  Структура: КОНТАКТИ, АКЦІЇ, КАТЕГОРІЇ, ФІЛЬТРИ, МЕНЮ, ТЕКСТИ.
// =============================================================================

import type { Product, Promo, NavCategory } from "@/lib/types";

const A = (name: string) => `/assets/${name}`;

// ===== 1. КОНТАКТИ =====
export const CONTACTS = {
  phone: "+38 (050) 000-00-00",
  hours: "11:00 — 22:00",
  address: "вул. Незалежності, 7, м. Тульчин",
  addressShort: "Тульчин · Доставка та самовивіз",
  // запит для вбудованої Google-карти (без API-ключа)
  mapQuery: "вул. Незалежності, 7, Тульчин, Вінницька область, Україна",
  instagram: "#",
  telegram: "#",
  facebook: "#",
};

// ===== 2. АКЦІЇ (банери) =====
export const PROMOS: Promo[] = [
  {
    id: 1,
    bannerImage: A("promo-imperia.png"),
    label: "ЛИШЕ ДО 31 ТРАВНЯ",
    title: "Сет Імперія за суперціною",
    price: 699,
    oldPrice: 999,
    linkedItemId: 9,
  },
  {
    id: 2,
    bannerImage: A("promo-fudzi.png"),
    label: "РОЛ ДНЯ",
    title: "Фудзі лосось",
    price: 169,
    oldPrice: 249,
    linkedItemId: 12,
  },
  {
    id: 3,
    bannerImage: A("promo-filadelfia.png"),
    label: "ТІЛЬКИ ДО 25 ТРАВНЯ",
    title: "Сет Філадельфія для двох",
    price: 599,
    oldPrice: 849,
    linkedItemId: 10,
  },
];

// ===== 3. КАТЕГОРІЇ ТА ФІЛЬТРИ =====
// Закріплені спец-пункти навігації (не є категоріями товарів).
// Решта пунктів навігації — динамічні категорії з categoriesStore.
export const NAV_SPECIALS: NavCategory[] = [
  { id: "novynky", label: "Новинки", filter: { badge: "НОВЕ" } },
  { id: "aktsii", label: "Акції", scrollTo: "hero" },
];

export const INGREDIENT_FILTERS = [
  "Всі", "Лосось", "Тунець", "Угор", "Авокадо", "Сир", "Креветка", "Огірок", "Гриль", "Краб",
];

// ===== 4. МЕНЮ =====
export const MENU: Product[] = [
  { id: 1, name: "Філадельфія класик", desc: "Лосось, сир, авокадо",
    photo: A("dish-salmon-pair.png"),
    fullDesc: "Ніжний рол з слабосоленим лососем, вершковим сиром та свіжим авокадо. Класика, яка ніколи не набридне.",
    composition: "Рис, норі, лосось слабосолений, сир вершковий, авокадо, огірок, соус унагі",
    price: 260, weight: "290 г", pieces: "8 шт", badge: "ХІТ",
    category: "роли", ingredients: ["лосось", "сир", "авокадо"], isHit: true },

  { id: 2, name: "Каліфорнія", desc: "Краб, авокадо, огірок",
    photo: A("dish-green-pair.png"),
    fullDesc: "Легкий та свіжий рол з крабом, авокадо та хрустким огірком. Ідеальний вибір для літа.",
    composition: "Рис, норі, краб, авокадо, огірок, ікра тобіко, майонез",
    price: 240, weight: "280 г", pieces: "8 шт", badge: "ХІТ",
    category: "роли", ingredients: ["краб", "авокадо", "огірок"], isHit: true },

  { id: 3, name: "Дракон", desc: "Угор, авокадо, тобіко",
    photo: A("dish-grilled-stack.jpg"),
    fullDesc: "Розкішний рол з ніжним угром, авокадо та ікрою тобіко. Для справжніх цінителів.",
    composition: "Рис, норі, угор копчений, авокадо, ікра тобіко, соус унагі, кунжут",
    price: 320, weight: "300 г", pieces: "8 шт", badge: "НОВЕ",
    category: "роли", ingredients: ["угор", "авокадо"], isHit: true },

  { id: 4, name: "Темпура", desc: "Креветка, сир, соус",
    photo: A("dish-gold-chopsticks.jpg"),
    fullDesc: "Хрусткий рол у темпурі з креветкою та вершковим сиром. Подається теплим.",
    composition: "Рис, норі, креветка, сир вершковий, соус спайсі, темпурне тісто",
    price: 280, weight: "270 г", pieces: "8 шт", badge: "ХІТ",
    category: "роли", ingredients: ["креветка", "сир"], isHit: true },

  { id: 5, name: "Спайсі лосось", desc: "Лосось, соус спайсі, огірок",
    photo: A("dish-salmon-pair.png"),
    fullDesc: "Гострий рол для тих, хто любить пікантні смаки. Лосось з фірмовим соусом спайсі.",
    composition: "Рис, норі, лосось, огірок, соус спайсі, кунжут",
    price: 270, weight: "260 г", pieces: "8 шт", badge: "",
    category: "роли", ingredients: ["лосось", "огірок"], isHit: false },

  { id: 6, name: "Запечена філа", desc: "Лосось, сир, майонез",
    photo: A("dish-grilled-stack.jpg"),
    fullDesc: "Запечений рол з лососем під сирною шапкою. Подається гарячим.",
    composition: "Рис, норі, лосось, сир вершковий, майонез японський, соус унагі",
    price: 290, weight: "300 г", pieces: "8 шт", badge: "",
    category: "роли", ingredients: ["лосось", "сир", "гриль"], isHit: false },

  { id: 7, name: "Вулкан", desc: "Тунець, тобіко, соус",
    photo: A("dish-gold-chopsticks.jpg"),
    fullDesc: "Яскравий рол з тунцем та ікрою тобіко. Вибух смаку в кожному шматочку.",
    composition: "Рис, норі, тунець, ікра тобіко, соус спайсі, зелена цибуля",
    price: 340, weight: "310 г", pieces: "8 шт", badge: "НОВЕ",
    category: "роли", ingredients: ["тунець"], isHit: true },

  { id: 8, name: "Угор класик", desc: "Угор, огірок, авокадо",
    photo: A("dish-grilled-stack.jpg"),
    fullDesc: "Класичний рол з копченим угром, свіжим огірком та авокадо.",
    composition: "Рис, норі, угор копчений, огірок, авокадо, соус унагі, кунжут",
    price: 310, weight: "280 г", pieces: "8 шт", badge: "",
    category: "роли", ingredients: ["угор", "огірок", "авокадо"], isHit: false },

  { id: 9, name: "Сет Імперія", desc: "32 ролі, мікс смаків",
    photo: A("dish-imperia-set.jpg"),
    fullDesc: "Великий сет з 32 ролів — ідеальний для компанії або вечірки. Мікс найкращих смаків.",
    composition: "Філадельфія, Каліфорнія, Дракон, Темпура — по 8 шт кожного",
    price: 699, weight: "1200 г", pieces: "32 шт", badge: "ХІТ",
    category: "сети", ingredients: ["лосось", "краб", "сир", "авокадо"], isHit: true },

  { id: 10, name: "Сет Філадельфія для двох", desc: "24 ролі філадельфія",
    photo: A("dish-imperia-set.jpg"),
    fullDesc: "Романтичний сет з 24 ролів Філадельфія — ідеальний для побачення.",
    composition: "Філадельфія класик, Філадельфія з лососем, Філадельфія з авокадо — по 8 шт",
    price: 599, weight: "900 г", pieces: "24 шт", badge: "",
    category: "сети", ingredients: ["лосось", "сир", "авокадо"], isHit: false },

  { id: 11, name: "Місо суп", desc: "Тофу, водорості, цибуля",
    photo: null,
    fullDesc: "Традиційний японський суп з тофу, водоростями вакаме та зеленою цибулею.",
    composition: "Паста місо, тофу, водорості вакаме, зелена цибуля, бульйон даші",
    price: 89, weight: "300 мл", pieces: "1 порція", badge: "",
    category: "супи", ingredients: [], isHit: false },

  { id: 12, name: "Фудзі лосось", desc: "Лосось, огірок, авокадо, сирний крем",
    photo: A("dish-salmon-pair.png"),
    fullDesc: "Авторський рол від шеф-кухаря з ніжним лососем та фірмовим сирним кремом.",
    composition: "Рис, норі, лосось, огірок, авокадо, сир вершковий, крем-сир, соус унагі",
    price: 169, weight: "220 г", pieces: "8 шт", badge: "НОВЕ",
    category: "роли", ingredients: ["лосось", "огірок", "авокадо", "сир"], isHit: true },
];

// ===== 5. ТЕКСТИ =====
export const TEXTS = {
  tagline: "смакуй кожен момент",
  heroLead: "Преміальна доставка свіжих суші у Тульчині. Усі роли готуються лише після оформлення замовлення.",
  // Мінімальне замовлення вимкнено (рішення клієнта). 0 = без мінімуму.
  minOrder: 0,
  reviewThanks: "Дякуємо за ваш відгук! Ми обов'язково його прочитаємо.",
  footerTagline: "Преміальна доставка суші та самовивіз у Тульчині",
};

export const ASSET_ICONS = {
  cart: A("icon-cart.png"),
  instagram: A("icon-instagram.png"),
  telegram: A("icon-telegram.png"),
  logo: A("logo-fish.png"),
};
