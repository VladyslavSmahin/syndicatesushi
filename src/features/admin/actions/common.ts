"use server";

import { revalidateTag } from "next/cache";
import { isStaff } from "@/lib/adminAuth";
import { ADMIN_TAG } from "../adminCache";

/** Глобальне оновлення: скидає кеш усіх серверних списків адмінки. */
export async function refreshAdminAction(): Promise<void> {
  if (!(await isStaff())) return;
  revalidateTag(ADMIN_TAG);
}
