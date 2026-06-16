// Спільний slugify (використовується і клієнтським db.ts, і серверними actions).
export function slugify(s: string): string {
  return (
    (s.toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item") +
    "-" + Math.random().toString(36).slice(2, 7)
  );
}
