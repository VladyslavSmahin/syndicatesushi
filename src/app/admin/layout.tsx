import { AdminAuthProvider } from "@/features/admin/AdminAuthContext";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: "Адмінка — Sushi Syndicate",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
