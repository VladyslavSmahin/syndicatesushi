import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin-клієнт із service_role ключем. ОБХОДИТЬ RLS — лише на сервері!
// Використовувати для серверних дій (створення замовлення тощо).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
