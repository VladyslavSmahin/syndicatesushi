import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseContacts, type SiteContacts } from "@/lib/contacts";

/** Контакти для серверних сторінок (оферта, політика) — без завантаження всього каталогу. */
export async function fetchContacts(): Promise<SiteContacts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", "contacts").maybeSingle();
  if (error) console.error("contacts fetch:", error.message);
  return parseContacts(data?.value);
}
