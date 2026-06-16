"use server";

import { revalidateTag } from "next/cache";
import { ADMIN_TAG } from "../adminCache";

/** Глобальне оновлення: скидає кеш усіх серверних списків адмінки. */
export async function refreshAdminAction(): Promise<void> {
  revalidateTag(ADMIN_TAG);
}
