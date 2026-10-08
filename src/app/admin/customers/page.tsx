"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/admin/Modal";
import {
  useDbCustomers, dbCustomerOrders, dbAllClientOrders,
  type DbCustomer, type OrderStatus, type ClientOrder,
} from "@/features/admin/db";
import s from "@/components/admin/admin.module.css";
import { useSort, SortLabel } from "@/components/admin/useSort";

const STATUS_LABEL: Record<OrderStatus, string> = { new: "Нове", confirmed: "Підтверджено", done: "Виконано", canceled: "Скасовано" };
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" }) : "—");
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

type Tab = "all" | "registered";
type Col = "name" | "phone" | "count" | "sum" | "last";

/** Клієнт, що будь-коли замовляв: групуємо замовлення за номером телефону. */
interface Client {
  key: string;            // phone_norm або сирий номер
  name: string;           // ім'я з останнього замовлення
  phone: string;
  count: number;          // замовлень без скасованих
  sum: number;
  lastAt: string;
  account: DbCustomer | null; // зареєстрований акаунт із цим номером (або з замовлень з акаунта)
  orders: ClientOrder[];
}

const money = (n: number) => `${Math.round(n).toLocaleString("uk-UA")} грн`;
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function CustomersPage() {
  const { customers, loading: custLoading, refetch } = useDbCustomers();
  const [orders, setOrders] = useState<ClientOrder[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DbCustomer | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => { dbAllClientOrders().then(setOrders); }, []);
  // ?tab=registered — перехід зі статистики одразу на «Зареєстровані»
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "registered") setTab("registered");
  }, []);

  // усі клієнти із замовлень, згруповані за номером
  const clients = useMemo<Client[]>(() => {
    if (!orders) return [];
    const byPhone = new Map(customers.filter((c) => c.phoneNorm).map((c) => [c.phoneNorm!, c] as const));
    const byId = new Map(customers.map((c) => [c.id, c] as const));
    const map = new Map<string, Client>();
    for (const o of orders) { // від нових до старих — перше ім'я = останнє
      const key = o.phoneNorm ?? o.phone.trim();
      let c = map.get(key);
      if (!c) {
        c = { key, name: o.customerName, phone: o.phone, count: 0, sum: 0, lastAt: o.createdAt, account: null, orders: [] };
        map.set(key, c);
      }
      c.orders.push(o);
      if (o.status !== "canceled") { c.count++; c.sum += o.total; }
      if (!c.account) c.account = (o.userId && byId.get(o.userId)) || (o.phoneNorm && byPhone.get(o.phoneNorm)) || null;
    }
    return [...map.values()];
  }, [orders, customers]);

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const match = (name: string, phoneNorm: string | null, email = "") =>
    !needle || name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle)
    || (digits.length >= 3 && (phoneNorm ?? "").includes(digits));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredClients = useMemo(() => clients.filter((c) => match(c.name, c.key, c.account?.email)), [clients, needle]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredRegistered = useMemo(() => customers.filter((c) => match(c.name ?? "", c.phoneNorm, c.email)), [customers, needle]);

  // сортування кліком по заголовку колонки (на телефоні — кнопками, заголовків там немає)
  const allSort = useSort<Client, Col>(filteredClients, {
    name: (c) => c.name.toLowerCase(), phone: (c) => c.key, count: (c) => c.count, sum: (c) => c.sum, last: (c) => c.lastAt,
  }, { key: "sum" });
  const regSort = useSort<DbCustomer, Col>(filteredRegistered, {
    name: (c) => (c.name || c.email).toLowerCase(), phone: (c) => c.phoneNorm ?? "", count: (c) => c.ordersCount,
    sum: (c) => c.ordersTotal, last: (c) => c.lastOrderAt ?? c.createdAt,
  }, { key: "sum" });
  const sort = tab === "all" ? allSort : regSort;
  const shownClients = allSort.sorted;
  const shownRegistered = regSort.sorted;
  const head = (k: Col, label: string, style?: React.CSSProperties) => (
    <SortLabel active={sort.key === k} dir={sort.dir} onClick={() => { allSort.toggle(k); regSort.toggle(k); }} style={style}>{label}</SortLabel>
  );

  // після refetch оновлюємо відкриту картку
  useEffect(() => {
    setSelected((cur) => (cur ? customers.find((c) => c.id === cur.id) ?? null : cur));
  }, [customers]);

  const loading = tab === "all" ? !orders || custLoading : custLoading;
  const registeredCount = clients.filter((c) => c.account).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className={s.presetRow}>
        {([["all", `Усі клієнти · ${clients.length}`], ["registered", `Зареєстровані · ${customers.length}`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`chip square ${tab === v ? "active" : ""}`}>{l}</button>
        ))}
      </div>

      <p className={s.hint} style={{ margin: 0, fontSize: 13 }}>
        {tab === "all"
          ? <>Усі, хто будь-коли замовляв (за номером телефону). Сума й кількість — без скасованих. <span className={s.cReg}>✓</span> — є акаунт на сайті ({registeredCount} з {clients.length}).</>
          : <>Акаунти на сайті. Клієнту рахуються замовлення з акаунта й усі замовлення на номер із його профілю.</>}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: ім'я, номер, email"
          style={{ flex: "1 1 200px", maxWidth: 360, padding: "8px 12px" }} />
        {/* на телефоні заголовків колонок немає — сортування кнопками (повторний клік — зворотний напрямок) */}
        <div className={`${s.presetRow} ${s.mobileOnly}`}>
          {([["sum", "Сума"], ["count", "К-сть"], ["last", "Дата"], ["name", "Ім'я"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { allSort.toggle(v); regSort.toggle(v); }} className={`chip square ${sort.key === v ? "active" : ""}`}>
              {l}{sort.key === v ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
            </button>
          ))}
        </div>
      </div>

      <div className={s.clientList}>
        <div className={s.clientHead}>
          {head("name", "Клієнт")}{head("phone", "Телефон")}{head("count", "Замовлень")}
          {head("sum", "Сума", { justifySelf: "end" })}{head("last", "Останнє", { justifySelf: "end" })}
        </div>
        {loading ? (
          <p className={s.hint} style={{ padding: 14, margin: 0 }}>Завантаження…</p>
        ) : tab === "all" ? (
          shownClients.length === 0 ? <p className={s.hint} style={{ padding: 14, margin: 0 }}>Нічого не знайдено.</p>
          : shownClients.map((c) => (
            <button key={c.key} type="button" className={s.clientRow}
              onClick={() => (c.account ? setSelected(c.account) : setSelectedClient(c))}>
              <span className={s.cName}>
                {c.name}
                <span className={`${s.cReg} ${c.account ? "" : s.cRegNo}`} title={c.account ? `Зареєстрований: ${c.account.email}` : "Без акаунта"}>
                  {c.account ? "✓" : "—"}
                </span>
              </span>
              <span className={s.cPhone}>{c.phone}</span>
              <span className={s.cCount}>{c.count} замовл.</span>
              <span className={s.cSum}>{money(c.sum)}</span>
              <span className={s.cLast}>{shortDate(c.lastAt)}</span>
            </button>
          ))
        ) : (
          shownRegistered.length === 0 ? <p className={s.hint} style={{ padding: 14, margin: 0 }}>
            {customers.length ? "Нічого не знайдено." : "Поки що жоден клієнт не зареєструвався."}
          </p>
          : shownRegistered.map((c) => (
            <button key={c.id} type="button" className={s.clientRow} onClick={() => setSelected(c)}>
              <span className={s.cName}>
                {c.name || c.email}
                <span className={s.cReg} title={c.provider === "google" ? "Через Google" : "Поштою"}>
                  {c.provider === "google" ? "G" : "@"}
                </span>
              </span>
              <span className={s.cPhone}>
                {c.phone || "без номера"}
              </span>
              <span className={s.cCount}>{c.ordersCount} замовл.</span>
              <span className={s.cSum}>{money(c.ordersTotal)}</span>
              <span className={s.cLast}>{shortDate(c.lastOrderAt ?? c.createdAt)}</span>
            </button>
          ))
        )}
      </div>
      {tab === "registered" && (
        <p className={s.hint} style={{ margin: 0, fontSize: 12 }}>
          G — через Google, @ — поштою; ✓ — номер підтверджено; <span style={{ color: "var(--accent)" }}>+N</span> — замовлень на номер, які привʼяжуться після підтвердження.
        </p>
      )}

      {selected && <CustomerModal customer={selected} onClose={() => setSelected(null)} />}
      {selectedClient && <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
    </div>
  );
}

/** Клієнт без акаунта: історія замовлень за номером (уже завантажена). */
function ClientModal({ client: c, onClose }: { client: Client; onClose: () => void }) {
  return (
    <Modal title={c.name} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
          <a href={`tel:${c.phone}`} style={{ color: "var(--accent)" }}>{c.phone}</a>
          <span className={`${s.pill} ${s.pillOff}`}>без акаунта</span>
        </div>
        <div className={s.statGridCompact}>
          <MiniStat num={c.count} label="Замовлень" />
          <MiniStat num={money(c.sum)} label="Сума" />
          <MiniStat num={c.count ? money(c.sum / c.count) : "—"} label="Сер. чек" />
        </div>
        <OrderList orders={c.orders.map((o) => ({ ...o, fromAccount: true }))} linkedAll />
      </div>
    </Modal>
  );
}

/** Компактний список замовлень у картці клієнта. */
function OrderList({ orders, linkedAll = false, verified = false }: {
  orders: { id: string; status: OrderStatus; deliveryType: "delivery" | "pickup"; total: number; createdAt: string; fromAccount: boolean; items: string[] }[];
  linkedAll?: boolean; verified?: boolean;
}) {
  if (!orders.length) return <p className={s.hint}>Замовлень немає.</p>;
  return (
    <div className={s.clientList}>
      {orders.map((o) => {
        const linked = linkedAll || o.fromAccount || verified;
        return (
          <div key={o.id} style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", opacity: o.status === "canceled" ? 0.5 : linked ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
              <span>{dateTime(o.createdAt)} · {STATUS_LABEL[o.status]}</span>
              <b style={{ whiteSpace: "nowrap" }}>{money(o.total)}</b>
            </div>
            <div className={s.hint} style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
              {o.deliveryType === "delivery" ? "Доставка" : "Самовивіз"} · {o.items.join(", ")}
              {!linkedAll && !o.fromAccount && (linked ? " · за номером" : " · за номером, не привʼязано")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerModal({ customer: c, onClose }: { customer: DbCustomer; onClose: () => void }) {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof dbCustomerOrders>> | null>(null);

  useEffect(() => {
    let active = true;
    setOrders(null);
    dbCustomerOrders(c).then((o) => { if (active) setOrders(o); });
    return () => { active = false; };
  }, [c]);

  const avg = c.ordersCount ? Math.round(c.ordersTotal / c.ordersCount) : 0;

  return (
    <Modal title={c.name || c.email} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className={s.hint} style={{ fontSize: 13 }}>
          {c.email} ({c.emailConfirmed ? "пошту підтверджено" : "пошту НЕ підтверджено"}) ·{" "}
          {c.provider === "google" ? "через Google" : "поштою"} · зареєстрований {date(c.createdAt)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {c.phone ? (
            <>
              <a href={`tel:${c.phone}`} style={{ color: "var(--accent)" }}>{c.phone}</a>
              {c.phoneOrders > 0 && <span className={s.hint} style={{ fontSize: 12 }}>· на цей номер {c.phoneOrders} замовл.</span>}
            </>
          ) : <span className={s.hint}>Номер не вказано</span>}
        </div>

        <div className={s.statGridCompact}>
          <MiniStat num={c.ordersCount} label="Замовлень" />
          <MiniStat num={`${c.ordersTotal} грн`} label="Сума" />
          <MiniStat num={avg ? `${avg} грн` : "—"} label="Сер. чек" />
        </div>

        <div>
          <div className={s.fieldLabel} style={{ marginBottom: 8 }}>Замовлення</div>
          {!orders ? <p className={s.hint}>Завантаження…</p> : <OrderList orders={orders} verified />}
        </div>
      </div>
    </Modal>
  );
}

function MiniStat({ num, label }: { num: string | number; label: string }) {
  return (
    <div className={s.card}>
      <div className={s.stat}>
        <div className={s.statNum}>{num}</div>
        <div className={s.statLabel}>{label}</div>
      </div>
    </div>
  );
}
