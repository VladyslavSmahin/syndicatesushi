import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { PUBLIC_TAG, PUBLIC_REVALIDATE } from "@/features/publicCache";
import { OG_IMAGE } from "@/lib/seo";

async function queryOgImage(): Promise<string> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", "og_image").maybeSingle();
  if (error) console.error("og_image fetch:", error.message);
  const url = (data?.value as { url?: unknown } | null)?.url;
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : OG_IMAGE;
}

/** Картинка превʼю посилання (адмінка → SEO); без неї — стандартна /og-cover.jpg. Кеш — під PUBLIC_TAG. */
export const fetchOgImage = cache(
  unstable_cache(queryOgImage, ["public-og-image"], { tags: [PUBLIC_TAG], revalidate: PUBLIC_REVALIDATE })
);
