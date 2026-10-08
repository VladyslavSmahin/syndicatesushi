import { NextResponse } from "next/server";
import { isStaff } from "@/lib/adminAuth";
import { uploadTikTokThumb, BROWSER_UA } from "@/lib/imageUpload";
import { tiktokVideoId, type TikTokVideo } from "@/lib/tiktok";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

// POST /api/tiktok { url } — лише співробітники. Розбирає посилання на ролик (і короткі vm./vt.tiktok.com),
// бере підпис і обкладинку з oEmbed TikTok, копіює обкладинку в R2. Повертає TikTokVideo; зберігає форма в адмінці.
type OEmbed = { title?: string; thumbnail_url?: string; author_unique_id?: string };

/** oEmbed TikTok нестабільний: той самий запит то 200, то «overload-protect»/HTML. До 3 спроб із різними заголовками. */
async function fetchOEmbed(url: string): Promise<OEmbed | null> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const variants: Record<string, string>[] = [{ "User-Agent": BROWSER_UA }, { "User-Agent": "curl/8.7.1", Accept: "*/*" }, { "User-Agent": BROWSER_UA }];
  for (const [i, headers] of variants.entries()) {
    try {
      const r = await fetch(endpoint, { headers, cache: "no-store" });
      const text = await r.text();
      if (r.ok && text.trim().startsWith("{")) {
        const j = JSON.parse(text) as OEmbed;
        if (j.thumbnail_url) return j;
      }
    } catch { /* наступна спроба */ }
    if (i < variants.length - 1) await new Promise((res) => setTimeout(res, 700));
  }
  return null;
}

export async function POST(req: Request) {
  if (!(await isStaff())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  let url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^https:\/\/([a-z]+\.)?tiktok\.com\//i.test(url)) return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });

  // коротке посилання з телефону (vm.tiktok.com/…) → повне, з id ролика
  if (!tiktokVideoId(url)) {
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
      url = r.url;
    } catch { /* лишаємо як є — нижче відповімо bad_url */ }
  }
  const id = tiktokVideoId(url);
  if (!id) return NextResponse.json({ ok: false, error: "not_video" }, { status: 400 });

  const meta = await fetchOEmbed(url);
  if (!meta?.thumbnail_url) return NextResponse.json({ ok: false, error: "oembed_failed" }, { status: 502 });

  const thumb = await uploadTikTokThumb(meta.thumbnail_url, id);
  if ("error" in thumb) return NextResponse.json({ ok: false, error: thumb.error }, { status: thumb.status });

  const canonical = meta.author_unique_id ? `https://www.tiktok.com/@${meta.author_unique_id}/video/${id}` : url.split("?")[0];
  const video: TikTokVideo = { id, url: canonical, title: (meta.title ?? "").slice(0, 300), thumb: thumb.url };
  return NextResponse.json({ ok: true, video });
}
