// Старт сервера на проді (перший запит після деплою): якщо в «Що нового» з'явилась нова версія —
// один раз розсилаємо співробітникам пуш «Оновлення адмінки». Не довше 4 с, щоб не гальмувати запит.
// Імпорт — лише всередині перевірки NEXT_RUNTIME: так Next викидає node-код (web-push) зі збірки edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL_ENV !== "production") return;
    const { notifyStaffRelease } = await import("@/lib/push.server");
    await Promise.race([notifyStaffRelease(), new Promise((r) => setTimeout(r, 4000))]);
  }
}
