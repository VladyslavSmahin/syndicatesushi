import { redirect } from "next/navigation";

// Окремий список замовлень прибрано: замовлення — на дошці, по клієнтах — у «Клієнти».
// Старі посилання/закладки ведуть на дошку.
export default function OrdersPage() {
  redirect("/admin/orders/board");
}
