"use client";

// ДЕМО-авторизація адмінки (без бекенда).
// На етапі Supabase замінюється на реальний Supabase Auth (Google) + білий список
// у таблиці allowed_staff + роль у profiles. Тут — лише імітація для перегляду UX.

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Role = "admin" | "editor";

export interface StaffMember {
  id: string;
  email: string;
  role: Role;
  addedAt: string;
}

interface CurrentUser {
  email: string;
  name: string;
  role: Role;
}

interface AdminAuthValue {
  user: CurrentUser | null;
  /** ДЕМО-логін через Google (імітація) */
  loginWithGoogle: () => void;
  logout: () => void;
  /** ДЕМО-перемикач ролі для перегляду обмежень editor */
  setRole: (r: Role) => void;
  staff: StaffMember[];
  addStaff: (email: string, role: Role) => { ok: boolean; error?: string };
  removeStaff: (id: string) => void;
  updateStaffRole: (id: string, role: Role) => void;
}

const Ctx = createContext<AdminAuthValue | null>(null);

const USER_KEY = "ss_admin_user_v1";
const STAFF_KEY = "ss_staff_v1";

const OWNER: CurrentUser = { email: "owner@sushisyndicate.ua", name: "Власник", role: "admin" };

const DEFAULT_STAFF: StaffMember[] = [
  { id: "1", email: "owner@sushisyndicate.ua", role: "admin", addedAt: new Date().toISOString() },
];

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>(DEFAULT_STAFF);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const u = localStorage.getItem(USER_KEY);
      if (u) setUser(JSON.parse(u));
      const s = localStorage.getItem(STAFF_KEY);
      if (s) setStaff(JSON.parse(s));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
      localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    } catch {
      /* ignore */
    }
  }, [user, staff, hydrated]);

  const loginWithGoogle = useCallback(() => setUser(OWNER), []);
  const logout = useCallback(() => setUser(null), []);
  const setRole = useCallback((role: Role) => setUser((u) => (u ? { ...u, role } : u)), []);

  const addStaff = useCallback(
    (email: string, role: Role) => {
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "Невірний email" };
      if (staff.some((m) => m.email.toLowerCase() === e)) return { ok: false, error: "Такий email вже додано" };
      setStaff((prev) => [...prev, { id: crypto.randomUUID(), email: e, role, addedAt: new Date().toISOString() }]);
      return { ok: true };
    },
    [staff]
  );

  const removeStaff = useCallback((id: string) => setStaff((prev) => prev.filter((m) => m.id !== id)), []);
  const updateStaffRole = useCallback(
    (id: string, role: Role) => setStaff((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m))),
    []
  );

  return (
    <Ctx.Provider value={{ user, loginWithGoogle, logout, setRole, staff, addStaff, removeStaff, updateStaffRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
