import "server-only";

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
}

export const ADMIN_PER_PAGE = 20;

/** Безпечно дістати number зі searchParams (1-based сторінка). */
export function parsePage(v: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(v) ? v[0] : v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Рядок пошуку зі searchParams. */
export function parseQuery(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function makePageResult<T>(rows: T[], total: number, page: number, perPage = ADMIN_PER_PAGE): PageResult<T> {
  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}
