import "server-only";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadTikTokThumb, BROWSER_UA } from "@/lib/imageUpload";
import { r2Delete, r2KeyFromUrl } from "@/lib/r2";
import { PUBLIC_TAG } from "@/features/publicCache";
import { parseTikTok, tiktokUsername, type TikTokVideo } from "@/lib/tiktok";

// Режим «auto» блоку TikTok: беремо список останніх роликів зі сторінки офіційного віджета профілю
// (tiktok.com/embed/@user — та сама, з якої TikTok будує свій віджет), копіюємо обкладинки в R2
// (їхні посилання підписані й живуть ~добу) і зберігаємо в settings.tiktok.autoVideos.
// Неофіційно: якщо TikTok змінить сторінку або не відповість — лишається останній збережений список.

const MAX = 12;
export const TIKTOK_SYNC_EVERY_MS = 2 * 60 * 60 * 1000; // не частіше ніж раз на 2 години (крім кнопки в адмінці)

type EmbedVideo = { id?: string; desc?: string; coverUrl?: string; originCoverUrl?: string; playCount?: number; privateItem?: boolean };

/** TikTok приблизно на половину запитів відповідає 503 «overload-protect» — до 6 спроб із паузою. */
async function fetchEmbedVideos(user: string): Promise<EmbedVideo[] | null> {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`https://www.tiktok.com/embed/@${user}`, {
        headers: { "User-Agent": BROWSER_UA, "Accept-Language": "uk,en;q=0.8" }, cache: "no-store",
      });
      if (r.ok) {
        const html = await r.text();
        const m = html.match(/<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          const state = JSON.parse(m[1]) as { source?: { data?: Record<string, { videoList?: EmbedVideo[] }> } };
          const page = Object.values(state.source?.data ?? {}).find((d) => Array.isArray(d?.videoList));
          if (page?.videoList) return page.videoList;
        }
      }
    } catch { /* наступна спроба */ }
    await new Promise((res) => setTimeout(res, 2500));
  }
  return null;
}

let running = false;

/** Синхронізація. force — без перевірки «минуло 2 години» (кнопка в адмінці). Повертає підсумок для адмінки. */
export async function syncTikTok(force = false): Promise<{ ok: boolean; error?: string; count?: number; added?: number }> {
  if (running) return { ok: false, error: "busy" };
  running = true;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("settings").select("value").eq("key", "tiktok").maybeSingle();
    const raw = (data?.value ?? {}) as Record<string, unknown>;
    const block = parseTikTok(raw);
    const user = tiktokUsername(block.profileUrl);
    if (!user || block.mode !== "auto") return { ok: false, error: "not_auto" };
    if (!force && block.syncedAt && Date.now() - Date.parse(block.syncedAt) < TIKTOK_SYNC_EVERY_MS) return { ok: true, count: block.autoVideos.length, added: 0 };

    const list = await fetchEmbedVideos(user);
    if (!list) return { ok: false, error: "tiktok_unavailable" };

    const prev = new Map(block.autoVideos.map((v) => [v.id, v]));
    const next: TikTokVideo[] = [];
    let added = 0;
    for (const v of list) {
      if (next.length >= MAX) break;
      if (!v.id || !/^\d{8,25}$/.test(v.id) || v.privateItem) continue;
      const url = `https://www.tiktok.com/@${user}/video/${v.id}`;
      const title = (v.desc ?? "").trim().slice(0, 300);
      const plays = Number.isFinite(Number(v.playCount)) ? Number(v.playCount) : undefined;
      const old = prev.get(v.id);
      if (old) { next.push({ ...old, title, url, ...(plays != null ? { plays } : null) }); continue; }
      const cover = v.originCoverUrl || v.coverUrl;
      if (!cover) continue;
      const up = await uploadTikTokThumb(cover, v.id);
      if ("error" in up) { console.error("tiktok cover:", v.id, up.error); continue; }
      next.push({ id: v.id, url, title, thumb: up.url, ...(plays != null ? { plays } : null) });
      added++;
    }
    if (!next.length) return { ok: false, error: "empty_list" };

    // обкладинки роликів, що випали зі списку, прибираємо з R2 (лише свої, з теки tiktok/)
    const keep = new Set(next.map((v) => v.id));
    for (const old of block.autoVideos) {
      if (keep.has(old.id)) continue;
      const key = r2KeyFromUrl(old.thumb);
      if (key?.startsWith("tiktok/") && !block.videos.some((m) => m.id === old.id)) await r2Delete(key).catch(() => {});
    }

    const value = { ...raw, autoVideos: next, syncedAt: new Date().toISOString() };
    const { error } = await admin.from("settings").upsert({ key: "tiktok", value }, { onConflict: "key" });
    if (error) return { ok: false, error: "save_failed" };
    revalidateTag(PUBLIC_TAG);
    return { ok: true, count: next.length, added };
  } catch (e) {
    console.error("tiktok sync:", (e as Error).message);
    return { ok: false, error: "sync_failed" };
  } finally {
    running = false;
  }
}
