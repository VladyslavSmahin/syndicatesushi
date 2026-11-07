import { createClient } from "@/lib/supabase/server";
import { LOYALTY_CHECK, LOYALTY_SECTIONS } from "@/lib/loyaltyProgram";
import LoyaltyClient from "./LoyaltyClient";
import s from "@/components/admin/admin.module.css";

// Таб «Лояльність» в огляді: концепція програми лояльності + коментарі адмінів до кожного пункту.
// Текст концепції віддаємо лише admin — роль перевіряємо тут, на сервері (у концепції фінанси бізнесу).
export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (profile?.role !== "admin") {
    return (
      <div className={s.card}><div className={s.placeholder}><p className={s.hint}>Розділ доступний лише адміністратору.</p></div></div>
    );
  }

  return <LoyaltyClient sections={LOYALTY_SECTIONS} check={LOYALTY_CHECK} uid={user!.id} />;
}
