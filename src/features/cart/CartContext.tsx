"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CartItem, Product } from "@/lib/types";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  /** додати товар; price можна перевизначити (напр. акційна ціна) */
  add: (product: Product, priceOverride?: number) => void;
  changeQty: (id: string, delta: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** прибрати позиції за id (напр. сервер сказав, що їх уже немає) — з повідомленням */
  removeUnavailable: (ids: string[]) => void;
  /** звірити кошик з актуальним каталогом (ціни/назви, зниклі товари) */
  syncCatalog: (catalog: Product[]) => void;
  /** у кошику були товари, яких більше немає, — їх прибрано; показати повідомлення */
  removedNotice: boolean;
  dismissRemovedNotice: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "ss_cart_v1";
/** макс. кількість однієї позиції (збігається з лімітом /api/order) */
export const MAX_QTY = 100;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // останній відомий каталог (null — ще невідомий, звіряти нема з чим)
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [removedNotice, setRemovedNotice] = useState(false);

  // відновлення з localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // збереження
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  // Звірка з каталогом: кошик живе в localStorage і міг застаріти (товар видалили,
  // зняли з продажу, вимкнули категорію, змінили ціну). Ціну/назву оновлюємо з
  // каталогу, зниклі позиції прибираємо; кількість зберігаємо.
  useEffect(() => {
    if (!hydrated || !catalog) return;
    const byId = new Map(catalog.map((p) => [p.id, p] as const));
    let changed = false;
    let removed = false;
    const next: CartItem[] = [];
    for (const i of items) {
      const p = byId.get(i.id);
      if (!p) { removed = true; changed = true; continue; }
      const oldPrice = p.oldPrice != null && p.oldPrice > p.price ? p.oldPrice : undefined;
      const qty = Math.min(MAX_QTY, i.qty);
      if (p.name !== i.name || p.price !== i.price || oldPrice !== i.oldPrice || qty !== i.qty) {
        changed = true;
        next.push({ ...i, name: p.name, price: p.price, oldPrice, qty });
      } else next.push(i);
    }
    // без змін — нічого не чіпаємо (інакше ефект крутився б по колу)
    if (!changed) return;
    setItems(next);
    if (removed) setRemovedNotice(true);
  }, [hydrated, catalog, items]);

  // порожній каталог = дані не завантажились (або сторінка без каталогу) — не звіряємо,
  // інакше кошик «спорожнів» би через збій БД
  const syncCatalog = useCallback((c: Product[]) => {
    if (c.length) setCatalog(c);
  }, []);

  const removeUnavailable = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setRemovedNotice(true);
  }, []);

  const dismissRemovedNotice = useCallback(() => setRemovedNotice(false), []);

  const add = useCallback((product: Product, priceOverride?: number) => {
    const price = priceOverride ?? product.price;
    // стара ціна для закреслення (лише якщо реально є знижка)
    const oldPrice = product.oldPrice != null && product.oldPrice > price ? product.oldPrice : undefined;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: Math.min(MAX_QTY, i.qty + 1) } : i
        );
      }
      return [...prev, { id: product.id, name: product.name, price, oldPrice, qty: 1 }];
    });
  }, []);

  const changeQty = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, count, total, add, changeQty, remove, clear, removeUnavailable, syncCatalog, removedNotice, dismissRemovedNotice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
