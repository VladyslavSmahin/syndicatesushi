"use client";

// Історія змін цін у Supabase (таблиця price_history). Запис при зміні ціни,
// перегляд та відкат на сторінці /admin/price-history.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbUpdatePrice } from "./db";

export interface PriceChange { productId: string; name: string; from: number; to: number; }
export interface PriceHistoryEntry {
  id: string;
  at: string;            // ISO (created_at)
  type: "single" | "bulk";
  label: string;
  changes: PriceChange[];
  reverted: boolean;
}

export function useDbPriceHistory() {
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_history")
      .select("id, type, label, changes, reverted, created_at")
      .order("created_at", { ascending: false });
    if (error) console.error("price_history:", error.message);
    else setHistory((data ?? []).map((r) => ({
      id: r.id, at: r.created_at, type: r.type as "single" | "bulk",
      label: r.label, changes: (r.changes as PriceChange[]) ?? [], reverted: r.reverted,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { history, loading, refetch };
}

/** Записати зміну цін в історію. changes — лише ті товари, де ціна реально змінилась. */
export async function dbLogPriceChange(type: "single" | "bulk", label: string, changes: PriceChange[]) {
  if (!changes.length) return;
  await createClient().from("price_history").insert({ type, label, changes });
}

/** Відкотити зміну: повернути товарам ціни `from` і позначити запис відкоченим. */
export async function dbRevertPriceChange(entry: PriceHistoryEntry) {
  await Promise.all(entry.changes.map((c) => dbUpdatePrice(c.productId, c.from)));
  await createClient().from("price_history").update({ reverted: true }).eq("id", entry.id);
}
