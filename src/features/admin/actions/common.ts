"use server";

import { revalidateTag } from "next/cache";
import { isStaff } from "@/lib/adminAuth";
import { ADMIN_TAG } from "../adminCache";
import { PUBLIC_TAG } from "@/features/publicCache";

/** Глобальне оновлення: скидає кеш усіх серверних списків адмінки і публічного сайту. */
export async function refreshAdminAction(): Promise<void> {
  if (!(await isStaff())) return;
  revalidateTag(ADMIN_TAG);
  revalidateTag(PUBLIC_TAG);
}
