import { Sidebar } from "@/components/dashboard/sidebar";
import { getUserOrRedirect } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await getUserOrRedirect();

  return (
    <div className="grid min-h-dvh md:grid-cols-[16rem_1fr]">
      <Sidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
