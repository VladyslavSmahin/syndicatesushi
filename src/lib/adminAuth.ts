import "server-only";
import { createClient } from "@/lib/supabase/server";

// Чи запит від залогіненого staff (admin/editor) — за роллю з profiles.
export async function isStaff(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" || profile?.role === "editor";
}

// Чи запит від залогіненого головного адміністратора (тільки role = admin).
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin";
}
