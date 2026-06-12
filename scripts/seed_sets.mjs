// Сід ролів-компонентів та сетів у прод-БД.
// Запуск (сухий прогон, ROLLBACK):   node scripts/seed_sets.mjs
//        (запис, COMMIT):             CONFIRM=1 node scripts/seed_sets.mjs
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// --- env з .env.local ---
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const CONFIRM = process.env.CONFIRM === "1";

// --- транслітерація для slug ---
const MAP = { а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia",ы:"y",э:"e",ё:"e",ъ:"" };
const slugify = (name) => {
  const base = [...name.toLowerCase()].map((c) => MAP[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

// --- роли (нові). sub = slug підкатегорії або null (категорія «Роли») ---
const ROLLS = {
  vulkany: ["Вулкан з лососем", "Вулкан з тунцем", "Вулкан з крабом", "Вулкан з вугрем"],
  philadelphia: ["Філадельфія гриль з лососем", "Філадельфія в ікрі з лососем", "Філадельфія в ікрі з сніжним крабом", "Філадельфія mix з крабом та лососем", "Філадельфія mix з лососем", "Філадельфія mix з сніжним крабом", "Філадельфія в кунжуті з крабом", "Філадельфія з запальним окунем"],
  tempury: ["Темпура з креветкою", "Темпура з лососем", "Темпура з тунцем та ананасом", "Темпура з мідією well done"],
  californii: ["Каліфорнія в кунжуті з сніжним крабом"],
  futomaki: ["Футомакі з сніжним крабом", "Футомакі з лососем well done", "Футомакі з креветкою темпура", "Футомакі з мідією well done та чукою"],
  maki: ["Макі з лососем", "Макі з тунцем", "Макі з огірком", "Макі з вугрем", "Макі з авокадо", "Макі з чукою", "Макі з креветкою"],
  gunkany: ["Суші з лососем", "Запальний лосось", "Ґункан з лососем", "Ґункан з тобіко"],
  drakony: ["Зелений дракон", "Золотий дракон", "Червоний дракон", "Тигровий дракон"],
  __none__: ["Сирний гриль з грушею", "Сирний гриль з крабом", "Сирний гриль з креветкою", "Сирний з креветкою", "Сирний з крабом та креветкою", "Сирний з креветкою темпура", "Фірмовий рол з мідією well done", "Spring з креветкою темпура"],
};

// --- сети: name, price (грн), weight, items (канонічні назви ролів) ---
const SETS = [
  { name: "Сет запечених", price: 1000, weight: "1250 г", items: ["Вулкан з лососем", "Вулкан з тунцем", "Вулкан з крабом", "Вулкан з вугрем"] },
  { name: "Комбо BIG", price: 1480, weight: "1800 г", items: ["Філадельфія з лососем", "Сирний гриль з грушею", "Філадельфія в ікрі з лососем", "Каліфорнія в кунжуті з сніжним крабом", "Темпура з креветкою", "Темпура з лососем"] },
  { name: "Maki Set", price: 800, weight: "950 г", items: ["Макі з лососем", "Макі з тунцем", "Макі з огірком", "Макі з вугрем", "Макі з авокадо", "Макі з чукою", "Макі з креветкою"] },
  { name: "Сет Хокайдо", price: 500, weight: "570 г", items: ["Філадельфія з лососем", "Сирний гриль з крабом"] },
  { name: "Від шефа", price: 1200, weight: "1200 г", items: ["Філадельфія з вугрем", "Філадельфія Elite з креветкою", "Вулкан з лососем", "Вулкан з вугрем"] },
  { name: "Святковий", price: 920, weight: "1100 г", items: ["Фірмовий рол з мідією well done", "Футомакі з сніжним крабом", "Філадельфія mix з крабом та лососем", "Сирний з крабом та креветкою"] },
  { name: "Лосось екстра", price: 950, weight: "1200 г", items: ["Філадельфія з лососем", "Футомакі з лососем well done", "Філадельфія mix з лососем", "Вулкан з лососем"] },
  { name: "Гурман", price: 1150, weight: "1400 г", items: ["Філадельфія з лососем", "Філадельфія з тунцем", "Сирний з креветкою", "Філадельфія в кунжуті з крабом", "Фірмовий рол з мідією well done"] },
  { name: "Red Set", price: 1200, weight: "1200 г", items: ["Філадельфія з лососем", "Філадельфія гриль з лососем", "Філадельфія в ікрі з лососем", "Макі з лососем", "Суші з лососем", "Запальний лосось", "Ґункан з лососем", "Ґункан з тобіко"] },
  { name: "Філадельфія XL", price: 1600, weight: "1750 г", items: ["Філадельфія з лососем", "Філадельфія з тунцем", "Філадельфія з вугрем", "Філадельфія з креветкою", "Філадельфія копчений лосось", "Філадельфія з запальним окунем"] },
  { name: "Black Mix Set", price: 1300, weight: "1500 г", items: ["Темпура з тунцем та ананасом", "Темпура з лососем", "Футомакі з креветкою темпура", "Вулкан з лососем", "Футомакі з мідією well done та чукою"] },
  { name: "Big Love", price: 1400, weight: "1700 г", items: ["Вулкан з лососем", "Філадельфія з лососем", "Сирний гриль з креветкою", "Футомакі з лососем well done", "Фірмовий рол з мідією well done", "Філадельфія в ікрі з сніжним крабом"] },
  { name: "Філадельфія Сет", price: 1050, weight: "1200 г", items: ["Філадельфія з лососем", "Філадельфія з тунцем", "Філадельфія з вугрем", "Філадельфія з креветкою"] },
  { name: "Fish Boom", price: 1200, weight: "1200 г", items: ["Філадельфія BIG", "Філадельфія з вугрем", "Філадельфія з креветкою", "Філадельфія гриль з грушею"] },
  { name: "Ніжний", price: 950, weight: "1200 г", items: ["Вулкан з лососем", "Філадельфія з лососем", "Філадельфія з запальним окунем", "Філадельфія mix з сніжним крабом"] },
  { name: "Сет комбо", price: 1000, weight: "1250 г", items: ["Філадельфія з лососем", "Сирний з креветкою темпура", "Темпура з лососем", "Темпура з мідією well done"] },
  { name: "Set Syndicate", price: 1400, weight: "1400 г", items: ["Філадельфія Elite з креветкою", "Філадельфія BIG", "Spring з креветкою темпура", "Вулкан з вугрем"] },
  { name: "Gold Set", price: 1000, weight: "1200 г", items: ["Філадельфія з вугрем", "Сирний гриль з креветкою", "Фірмовий рол з мідією well done", "Вулкан з вугрем"] },
  { name: "Dragon Set", price: 1400, weight: "1200 г", items: ["Зелений дракон", "Золотий дракон", "Червоний дракон", "Тигровий дракон"] },
];

// Пароль містить спецсимволи → стандартний URL-парсер падає. Парсимо вручну.
const conn = env.SUPABASE_DB_URL_SP;
const m = conn.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(\w+)/);
if (!m) throw new Error("Не вдалося розібрати SUPABASE_DB_URL_SP");
const password = env.SUPABASE_DB_PASSWORD || m[2].replace(/^\[|\]$/g, "");
const client = new pg.Client({
  host: m[3], port: +m[4], database: m[5], user: m[1], password,
  ssl: { rejectUnauthorized: false },
});

const log = (...a) => console.log(...a);

await client.connect();
try {
  await client.query("begin");

  // 0) DDL set_items
  await client.query(fs.readFileSync(path.join("supabase", "migrations", "20260613090000_set_items.sql"), "utf8"));

  // 1) категорії / підкатегорії
  const cats = (await client.query("select id, slug from categories")).rows;
  const subs = (await client.query("select id, slug from subcategories")).rows;
  const catId = (slug) => cats.find((c) => c.slug === slug)?.id;
  const subId = (slug) => subs.find((s) => s.slug === slug)?.id;
  const ROLI = catId("роли"), SETY = catId("сети");
  if (!ROLI || !SETY) throw new Error("Не знайдено категорії роли/сети");

  // 2) існуючі товари: name -> id (не видалені)
  const existing = (await client.query("select id, name from products where deleted_at is null")).rows;
  const byName = new Map(existing.map((p) => [p.name.trim(), p.id]));

  // 3) вставляємо відсутні роли
  let rollsAdded = 0, rollsSkipped = 0, sort = 1000;
  for (const [sub, names] of Object.entries(ROLLS)) {
    const sid = sub === "__none__" ? null : subId(sub);
    if (sub !== "__none__" && !sid) throw new Error(`Немає підкатегорії: ${sub}`);
    for (const name of names) {
      if (byName.has(name)) { rollsSkipped++; continue; }
      const { rows } = await client.query(
        `insert into products (category_id, subcategory_id, name, slug, price, is_available, sort_order)
         values ($1,$2,$3,$4,$5,true,$6) returning id`,
        [ROLI, sid, name, slugify(name), 400, sort++]
      );
      byName.set(name, rows[0].id);
      rollsAdded++;
    }
  }

  // 4) сети + set_items
  let setsAdded = 0, setsSkipped = 0, links = 0;
  const missing = new Set();
  let ssort = 100;
  for (const set of SETS) {
    // перевіряємо, що всі компоненти знайдені
    for (const it of set.items) if (!byName.has(it)) missing.add(`${set.name} → ${it}`);
    if (byName.has(set.name)) { setsSkipped++; continue; }
    const { rows } = await client.query(
      `insert into products (category_id, name, slug, price, weight, is_available, sort_order)
       values ($1,$2,$3,$4,$5,true,$6) returning id`,
      [SETY, set.name, slugify(set.name), set.price, set.weight, ssort++]
    );
    const setId = rows[0].id;
    setsAdded++;
    let isort = 0;
    for (const it of set.items) {
      const pid = byName.get(it);
      if (!pid) continue;
      await client.query(
        `insert into set_items (set_id, product_id, qty, sort_order) values ($1,$2,1,$3)
         on conflict (set_id, product_id) do nothing`,
        [setId, pid, isort++]
      );
      links++;
    }
  }

  log("\n=== ПЛАН ===");
  log(`Роли: додано ${rollsAdded}, пропущено (вже є) ${rollsSkipped}`);
  log(`Сети: додано ${setsAdded}, пропущено (вже є) ${setsSkipped}`);
  log(`Звʼязків set_items: ${links}`);
  if (missing.size) { log("\n⚠ НЕ ЗНАЙДЕНО КОМПОНЕНТІВ:"); for (const m of missing) log("  -", m); }

  if (CONFIRM && missing.size === 0) {
    await client.query("commit");
    log("\n✅ COMMIT — записано в прод.");
  } else {
    await client.query("rollback");
    log(`\n↩ ROLLBACK (${CONFIRM ? "є ненайдені компоненти" : "сухий прогон; додай CONFIRM=1 для запису"}).`);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ПОМИЛКА:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
