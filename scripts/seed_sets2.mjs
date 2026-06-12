// Додаткові роли + сети (друга партія зі скрінів).
// Сухий прогон: node scripts/seed_sets2.mjs   |   Запис: CONFIRM=1 node scripts/seed_sets2.mjs
import fs from "node:fs";
import pg from "pg";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const CONFIRM = process.env.CONFIRM === "1";

const MAP = { а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia",ы:"y",э:"e",ё:"e",ъ:"" };
const slugify = (name) => {
  const base = [...name.toLowerCase()].map((c) => MAP[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

// нові роли за підкатегоріями
const ROLLS = {
  philadelphia: ["Філадельфія в кунжуті з креветкою", "Філадельфія тунець в тунці", "Філадельфія в ікрі з крабом"],
  californii: ["Каліфорнія в ікрі з крабом"],
};

const SETS = [
  { name: "XXL (для всіх і більше)", price: 1800, weight: "2300 г", items: ["Філадельфія з лососем", "Філадельфія гриль з лососем", "Фірмовий рол з мідією well done", "Каліфорнія в ікрі з крабом", "Філадельфія в кунжуті з креветкою", "Футомакі з лососем well done", "Сирний гриль з грушею", "Вулкан з лососем"] },
  { name: "L (для вас і більше)", price: 1150, weight: "1400 г", items: ["Філадельфія з лососем", "Сирний гриль з креветкою", "Футомакі з лососем well done", "Філадельфія тунець в тунці", "Філадельфія в ікрі з крабом"] },
  { name: "S (для неї)", price: 700, weight: "850 г", items: ["Вулкан з лососем", "Сирний гриль з креветкою", "Філадельфія в ікрі з сніжним крабом"] },
];

const conn = env.SUPABASE_DB_URL_SP;
const m = conn.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(\w+)/);
const password = env.SUPABASE_DB_PASSWORD || m[2].replace(/^\[|\]$/g, "");
const client = new pg.Client({ host: m[3], port: +m[4], database: m[5], user: m[1], password, ssl: { rejectUnauthorized: false } });
const log = (...a) => console.log(...a);

await client.connect();
try {
  await client.query("begin");
  const cats = (await client.query("select id, slug from categories")).rows;
  const subs = (await client.query("select id, slug from subcategories")).rows;
  const ROLI = cats.find((c) => c.slug === "роли")?.id, SETY = cats.find((c) => c.slug === "сети")?.id;
  const subId = (slug) => subs.find((x) => x.slug === slug)?.id;

  const existing = (await client.query("select id, name from products where deleted_at is null")).rows;
  const byName = new Map(existing.map((p) => [p.name.trim(), p.id]));

  let rollsAdded = 0, rollsSkipped = 0, sort = 2000;
  for (const [sub, names] of Object.entries(ROLLS)) {
    const sid = subId(sub);
    for (const name of names) {
      if (byName.has(name)) { rollsSkipped++; continue; }
      const { rows } = await client.query(
        `insert into products (category_id, subcategory_id, name, slug, price, is_available, sort_order)
         values ($1,$2,$3,$4,400,true,$5) returning id`, [ROLI, sid, name, slugify(name), sort++]);
      byName.set(name, rows[0].id); rollsAdded++;
    }
  }

  let setsAdded = 0, setsSkipped = 0, links = 0; const missing = new Set(); let ssort = 200;
  for (const set of SETS) {
    for (const it of set.items) if (!byName.has(it)) missing.add(`${set.name} → ${it}`);
    if (byName.has(set.name)) { setsSkipped++; continue; }
    const { rows } = await client.query(
      `insert into products (category_id, name, slug, price, weight, is_available, sort_order)
       values ($1,$2,$3,$4,$5,true,$6) returning id`, [SETY, set.name, slugify(set.name), set.price, set.weight, ssort++]);
    const setId = rows[0].id; setsAdded++;
    let isort = 0;
    for (const it of set.items) {
      const pid = byName.get(it); if (!pid) continue;
      await client.query(`insert into set_items (set_id, product_id, qty, sort_order) values ($1,$2,1,$3) on conflict do nothing`, [setId, pid, isort++]);
      links++;
    }
  }

  log(`\nРоли: +${rollsAdded} (пропущено ${rollsSkipped}) | Сети: +${setsAdded} (пропущено ${setsSkipped}) | звʼязків: ${links}`);
  if (missing.size) { log("⚠ НЕ ЗНАЙДЕНО:"); for (const x of missing) log("  -", x); }

  if (CONFIRM && missing.size === 0) { await client.query("commit"); log("✅ COMMIT"); }
  else { await client.query("rollback"); log(CONFIRM ? "↩ ROLLBACK (є ненайдені)" : "↩ ROLLBACK (сухий прогон; CONFIRM=1 для запису)"); }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ПОМИЛКА:", e.message); process.exitCode = 1;
} finally { await client.end(); }
