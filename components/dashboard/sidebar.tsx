import Link from "next/link";
import { Activity, BarChart3, Dumbbell, LayoutDashboard, Users } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/routines", label: "Routines", icon: Dumbbell },
  { href: "/dashboard/progress", label: "Progress", icon: BarChart3 }
];

export function Sidebar() {
  return (
    <aside className="flex min-h-dvh w-full flex-col border-r bg-white px-4 py-5 md:w-64">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
        Sthenos
      </Link>
      <nav className="grid gap-1">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="mt-auto pt-6">
        <Button type="submit" variant="ghost" className="w-full justify-start">
          Log out
        </Button>
      </form>
    </aside>
  );
}
