// Зменшені копії (~480px) для вже завантажених фото товарів — див. src/lib/thumb.ts.
// Нові фото отримують копію автоматично при завантаженні; скрипт — для старих.
//
//   node scripts/make_thumbs.mjs          — лише перевірка: скільки копій бракує
//   node scripts/make_thumbs.mjs --apply  — створити відсутні копії в R2
//
// У БД нічого не пише: адреса копії обчислюється з адреси оригіналу.
import fs from "node:fs";
import pg from "pg";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const apply = process.argv.includes("--apply");
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const m = env.SUPABASE_DB_URL_SP.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(\w+)/);
const db = new pg.Client({ host: m[3], port: +m[4], database: m[5], user: m[1], password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } });
await db.connect();
const rows = (await db.query("select distinct image_path from public.products where image_path like 'http%'")).rows;
await db.end();

const base = env.R2_PUBLIC_URL.replace(/\/+$/, "") + "/";
const PRODUCT_PHOTO = /^products\/[0-9a-f-]{36}\.webp$/i;
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

let missing = 0, created = 0, failed = 0, skipped = 0;
for (const { image_path: url } of rows) {
  const key = url.startsWith(base) ? url.slice(base.length) : null;
  if (!key || !PRODUCT_PHOTO.test(key)) { skipped++; continue; }
  const thumbKey = key.replace(/\.webp$/i, "_480.webp");
  const head = await fetch(base + thumbKey, { method: "HEAD" });
  if (head.ok) continue;
  missing++;
  if (!apply) continue;
  try {
    const orig = Buffer.from(await (await fetch(url)).arrayBuffer());
    const body = await sharp(orig)
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: thumbKey, Body: body, ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    created++;
    console.log(`✓ ${thumbKey} (${Math.round(orig.length / 1024)} → ${Math.round(body.length / 1024)} КБ)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${thumbKey}: ${e.message}`);
  }
}

console.log(`\nФото товарів: ${rows.length} | не з R2/нестандартні: ${skipped} | без копії: ${missing}`);
if (apply) console.log(`Створено: ${created}, помилок: ${failed}`);
else if (missing) console.log("Перевірка без змін. Щоб створити копії: node scripts/make_thumbs.mjs --apply");
