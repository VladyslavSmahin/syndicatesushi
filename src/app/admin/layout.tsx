import type { Metadata } from "next";
import { AdminAuthProvider } from "@/features/admin/AdminAuthContext";
import AdminShell from "@/components/admin/AdminShell";

// Адмінка — окремий застосунок на екрані «Додому»: свій маніфест (scope /admin), іконка з плашкою «АДМІН»
export const metadata: Metadata = {
  title: "Адмінка — Sushi Syndicate",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "SS Адмінка", statusBarStyle: "black" },
  icons: { apple: "/pwa/admin-apple-touch-icon.png" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
