// Український номер: лише цифри, формат «093 728 42 98» (10 цифр, починається з 0).
// Спільне для кошика й кабінету клієнта; на сервері та сама нормалізація — normalize_phone() у БД.

export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("380")) d = "0" + d.slice(3);   // +380XX… → 0XX…
  else if (d.startsWith("80")) d = "0" + d.slice(2); // 80XX…  → 0XX…
  return d.slice(0, 10);
}

export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}

export function isPhoneValid(raw: string): boolean {
  const d = phoneDigits(raw);
  return d.length === 10 && d.startsWith("0");
}
