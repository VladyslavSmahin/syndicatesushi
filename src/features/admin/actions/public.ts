"use server";

import { revalidateTag } from "next/cache";
import { isStaff } from "@/lib/adminAuth";
import { PUBLIC_TAG } from "@/features/publicCache";

/**
 * Скидає кеш публічного сайту. Адмінка пише в Supabase напряму з браузера,
 * тож сервер дізнається про зміни лише через цей виклик (див. touchPublic у db.ts).
 */
export async function revalidatePublicAction(): Promise<void> {
  if (!(await isStaff())) return;
  revalidateTag(PUBLIC_TAG);
}
