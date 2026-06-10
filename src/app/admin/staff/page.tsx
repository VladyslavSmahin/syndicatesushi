"use client";

import { useState } from "react";
import { useAdminAuth, type Role } from "@/features/admin/AdminAuthContext";
import s from "@/components/admin/admin.module.css";

export default function StaffPage() {
  const { user, staff, addStaff, removeStaff, updateStaffRole } = useAdminAuth();
  const isAdmin = user?.role === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState("");

  if (!isAdmin) {
    return (
      <div className={s.card}>
        <div className={s.placeholder}>
          <div className={s.placeholderTitle}>Доступ обмежено</div>
          <p className={s.hint}>Керувати співробітниками може лише головний адміністратор.</p>
        </div>
      </div>
    );
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addStaff(email, role);
    if (!res.ok) { setError(res.error ?? "Помилка"); return; }
    setEmail("");
    setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className={s.hint}>
        Додайте email співробітника у білий список — він зможе увійти через Google
        під цим email. Видалення з списку миттєво відкликає доступ.
        <br />
        <b>Роль «editor»</b> може все, крім видалення. <b>Роль «admin»</b> — повний доступ.
      </p>

      {/* Add form */}
      <form className={s.card} onSubmit={handleAdd}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Додати співробітника</div>
        </div>
        <div style={{ padding: 22 }}>
          <div className={s.formRow}>
            <div className={s.field} style={{ flex: 1, minWidth: 220 }}>
              <span className={s.fieldLabel}>Email (Google-акаунт)</span>
              <input
                className={s.input}
                type="email"
                placeholder="employee@gmail.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
              />
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>Роль</span>
              <select className={s.input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <button className={s.btn} type="submit" disabled={!email.trim()}>Додати</button>
          </div>
          {error && <p className={s.error} style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </form>

      {/* Table */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Білий список ({staff.length})</div>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Роль</th>
                <th>Додано</th>
                <th style={{ textAlign: "right" }}>Дії</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => {
                const isSelf = m.email === user?.email;
                return (
                  <tr key={m.id}>
                    <td>{m.email} {isSelf && <span className={s.hint} style={{ fontSize: 11 }}>(ви)</span>}</td>
                    <td>
                      <select
                        className={s.input}
                        style={{ width: "auto", padding: "6px 10px" }}
                        value={m.role}
                        disabled={isSelf}
                        onChange={(e) => updateStaffRole(m.id, e.target.value as Role)}
                      >
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {new Date(m.addedAt).toLocaleDateString("uk-UA")}
                    </td>
                    <td>
                      <div className={s.rowActions}>
                        <button
                          className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          disabled={isSelf}
                          onClick={() => removeStaff(m.id)}
                        >
                          Прибрати
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
