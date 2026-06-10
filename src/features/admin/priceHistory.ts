"use client";

import { createLocalStore } from "./createLocalStore";
import { productsStore } from "./stores";

export interface PriceChange {
  productId: string;
  name: string;
  from: number;
  to: number;
}

export interface PriceHistoryEntry {
  id: string;
  at: string;            // ISO
  type: "single" | "bulk";
  label: string;         // напр. "Філадельфія класик" або "Лосось +10 грн"
  changes: PriceChange[];
  reverted: boolean;
}

export const { store: priceHistoryStore, useItems: usePriceHistory } =
  createLocalStore<PriceHistoryEntry>("ss_price_history_v1", []);

/** Записати зміну цін в історію. changes — лише ті товари, де ціна реально змінилась. */
export function logPriceChange(type: "single" | "bulk", label: string, changes: PriceChange[]) {
  if (!changes.length) return;
  priceHistoryStore.add({ at: new Date().toISOString(), type, label, changes, reverted: false });
}

/** Відкотити зміну: повернути товарам ціни `from`. */
export function revertPriceChange(entry: PriceHistoryEntry) {
  entry.changes.forEach((c) => productsStore.update(c.productId, { price: c.from }));
  priceHistoryStore.update(entry.id, { reverted: true });
}
