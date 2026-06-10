"use client";

import { createBrowserClient } from "@supabase/ssr";

// Клієнт для браузера (компоненти "use client"). Захищено RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
