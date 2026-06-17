import "server-only";
import type { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-сумісне сховище для зображень (банери тощо).
// Ключі в .env.local / Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_PUBLIC_URL (публічний домен бакета, напр. https://pub-xxx.r2.dev).
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = process.env.R2_PUBLIC_URL;

/** Чи задані всі потрібні R2-змінні (інакше завантаження недоступне). */
export function r2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicUrl);
}

let _client: S3Client | null = null;
async function client(): Promise<S3Client> {
  if (!_client) {
    // динамічний імпорт SDK — щоб модуль не падав на імпорті у serverless
    const { S3Client } = await import("@aws-sdk/client-s3");
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return _client;
}

/** Завантажує об'єкт у R2 і повертає публічний URL. */
export async function r2Put(key: string, body: Buffer, contentType: string): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new PutObjectCommand({
    Bucket: bucket!, Key: key, Body: body, ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${publicUrl!.replace(/\/+$/, "")}/${key}`;
}

export async function r2Delete(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new DeleteObjectCommand({ Bucket: bucket!, Key: key }));
}

/** Витягує R2-ключ із публічного URL (для видалення). null — якщо URL не з нашого бакета. */
export function r2KeyFromUrl(url: string): string | null {
  if (!publicUrl) return null;
  const base = publicUrl.replace(/\/+$/, "") + "/";
  return url.startsWith(base) ? url.slice(base.length) : null;
}
