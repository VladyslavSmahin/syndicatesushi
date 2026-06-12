import fs from "node:fs";
import pg from "pg";
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const conn = env.SUPABASE_DB_URL_SP;
const m = conn.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(\w+)/);
const password = env.SUPABASE_DB_PASSWORD || m[2].replace(/^\[|\]$/g, "");
const c = new pg.Client({ host: m[3], port: +m[4], database: m[5], user: m[1], password, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query("begin");
  // категорії: 1..N за поточним порядком
  await c.query(`with o as (select id, row_number() over (order by sort_order, name) rn from categories)
                 update categories set sort_order = o.rn from o where categories.id = o.id`);
  // підкатегорії: 1..N в межах кожної категорії
  await c.query(`with o as (select id, row_number() over (partition by category_id order by sort_order, name) rn from subcategories)
                 update subcategories set sort_order = o.rn from o where subcategories.id = o.id`);
  await c.query("commit");
  const cats = (await c.query("select name, sort_order from categories order by sort_order")).rows;
  console.log("Категорії:", cats.map(r=>`${r.sort_order}:${r.name}`).join(", "));
  const subs = (await c.query("select name, sort_order from subcategories order by category_id, sort_order")).rows;
  console.log("Підкатегорій оновлено:", subs.length, "| приклад:", subs.slice(0,5).map(r=>`${r.sort_order}:${r.name}`).join(", "));
  console.log("✅ Переіндексовано");
} catch(e){ await c.query("rollback").catch(()=>{}); console.error("ПОМИЛКА:", e.message); process.exitCode=1; }
finally { await c.end(); }
