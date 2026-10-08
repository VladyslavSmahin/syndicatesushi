"use client";

// Обране (зірочка на товарі). Гість — у localStorage; залогінений клієнт — у БД (customer_favorites),
// а гостьове обране після входу зливається в акаунт і локально очищається.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchCustomerProfile } from "@/features/account";

interface FavoritesValue {
  ids: string[];
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  /** id клієнта, якщо обране зберігається в акаунті; null — гість (localStorage) */
  customerId: string | null;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

const STORAGE_KEY = "ss_favorites_v1";
const UUID_RE = /^[0-9a-f-]{36}$/i;

const readLocal = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)) : [];
  } catch { return []; }
};
const writeLocal = (ids: string[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
};

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ids, setIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const customerRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const local = readLocal();
    const profile = await fetchCustomerProfile().catch(() => null);
    if (!profile) {
      customerRef.current = null;
      setCustomerId(null);
      setIds(local);
      return;
    }
    // гостьове обране → в акаунт (дублікати ігноруємо; зниклі товари відсіє FK — тоді по одному)
    if (local.length) {
      const rows = local.map((product_id) => ({ customer_id: profile.id, product_id }));
      const { error } = await supabase.from("customer_favorites").upsert(rows, { ignoreDuplicates: true });
      const failed: string[] = [];
      if (error) {
        // по одному: товар, якого вже нема в базі (FK), просто відкидаємо; решта помилок — лишаємо локально
        for (const r of rows) {
          const { error: e } = await supabase.from("customer_favorites").upsert(r, { ignoreDuplicates: true });
          if (e && e.code !== "23503") failed.push(r.product_id);
        }
      }
      // стираємо локальне лише те, що вдалось перенести — інакше гостьове обране зникло б при збої мережі
      writeLocal(failed);
    }
    const { data, error } = await supabase
      .from("customer_favorites")
      .select("product_id")
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) console.error("favorites:", error.message);
    customerRef.current = profile.id;
    setCustomerId(profile.id);
    setIds((data ?? []).map((r) => r.product_id as string));
  }, [supabase]);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") load();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, load]);

  const idsRef = useRef<string[]>([]);
  useEffect(() => { idsRef.current = ids; }, [ids]);

  const toggle = useCallback((productId: string) => {
    if (!UUID_RE.test(productId)) return;
    const cid = customerRef.current;
    const prev = idsRef.current;
    const on = prev.includes(productId);
    const next = on ? prev.filter((x) => x !== productId) : [productId, ...prev];
    idsRef.current = next;
    setIds(next);
    if (!cid) { writeLocal(next); return; }
    const q = on
      ? supabase.from("customer_favorites").delete().eq("customer_id", cid).eq("product_id", productId)
      : supabase.from("customer_favorites").upsert({ customer_id: cid, product_id: productId }, { ignoreDuplicates: true });
    // не вдалося зберегти — повертаємо зірочку як було
    Promise.resolve(q).then(({ error }) => {
      if (!error) return;
      console.error("favorite toggle:", error.message);
      const back = on ? [productId, ...idsRef.current.filter((x) => x !== productId)] : idsRef.current.filter((x) => x !== productId);
      idsRef.current = back;
      setIds(back);
    });
  }, [supabase]);

  const value = useMemo<FavoritesValue>(() => ({
    ids, customerId, toggle, isFavorite: (id) => ids.includes(id),
  }), [ids, customerId, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
