// Категорія «Додатково» + товари (імбир, васабі, соуси, палички).
// Сухий прогон: node scripts/seed_extras.mjs   |   Запис: CONFIRM=1 node scripts/seed_extras.mjs
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

// name, price, weight
const ITEMS = [
  ["Імбир", 50, "50 г"],
  ["Васабі", 50, "40 г"],
  ["Соєвий соус 50 мл", 20, "50 мл"],
  ["Соєвий соус 150 мл", 50, "150 мл"],
  ["Соєвий соус 250 мл", 90, "250 мл"],
  ["Фірмовий соус", 30, "40 г"],
  ["Соус Унагі", 50, "40 г"],
  ["Палички", 5, "1 пара"],
];

const conn = env.SUPABASE_DB_URL_SP;
const m = conn.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(\w+)/);
const password = env.SUPABASE_DB_PASSWORD || m[2].replace(/^\[|\]$/g, "");
const client = new pg.Client({ host: m[3], port: +m[4], database: m[5], user: m[1], password, ssl: { rejectUnauthorized: false } });
const log = (...a) => console.log(...a);

await client.connect();
try {
  await client.query("begin");

  // категорія «Додатково» (не в навігації — лише для кошика), idempotent за slug
  let cat = (await client.query("select id from categories where slug=$1", ["додатково"])).rows[0];
  if (!cat) {
    const maxOrd = (await client.query("select coalesce(max(sort_order),0) as m from categories")).rows[0].m;
    cat = (await client.query(
      `insert into categories (name, slug, sort_order, show_in_nav, is_active) values ($1,$2,$3,false,true) returning id`,
      ["Додатково", "додатково", maxOrd + 10]
    )).rows[0];
    log("Категорію «Додатково» створено");
  } else log("Категорія «Додатково» вже існує");

  const existing = new Map((await client.query("select id, name from products where deleted_at is null")).rows.map((p) => [p.name.trim(), p.id]));
  let added = 0, skipped = 0, sort = 10;
  for (const [name, price, weight] of ITEMS) {
    if (existing.has(name)) { skipped++; continue; }
    await client.query(
      `insert into products (category_id, name, slug, price, weight, is_available, sort_order)
       values ($1,$2,$3,$4,$5,true,$6)`,
      [cat.id, name, slugify(name), price, weight, sort]
    );
    sort += 10; added++;
  }
  log(`Товари «Додатково»: +${added} (пропущено ${skipped})`);

  if (CONFIRM) { await client.query("commit"); log("✅ COMMIT"); }
  else { await client.query("rollback"); log("↩ ROLLBACK (сухий прогон; CONFIRM=1 для запису)"); }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ПОМИЛКА:", e.message); process.exitCode = 1;
} finally { await client.end(); }
