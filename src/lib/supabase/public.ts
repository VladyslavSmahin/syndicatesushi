import "server-only";
import { createClient } from "@supabase/supabase-js";

// Клієнт для публічних читань на сервері БЕЗ cookies (anon-ключ, діє RLS).
// Потрібен усередині unstable_cache: там не можна викликати cookies(),
// а публічним даним сесія користувача й не потрібна.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
