import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { PUBLIC_TAG, PUBLIC_REVALIDATE } from "@/features/publicCache";
import { parseContacts, type SiteContacts } from "@/lib/contacts";

async function queryContacts(): Promise<SiteContacts> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", "contacts").maybeSingle();
  if (error) console.error("contacts fetch:", error.message);
  return parseContacts(data?.value);
}

/** Контакти для серверних сторінок (оферта, політика) — без завантаження всього каталогу. Кеш — під PUBLIC_TAG. */
export const fetchContacts = cache(
  unstable_cache(queryContacts, ["public-contacts"], { tags: [PUBLIC_TAG], revalidate: PUBLIC_REVALIDATE })
);
