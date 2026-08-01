"use client";

import Link from "next/link";
import { Activity, BarChart3, Dumbbell, LayoutDashboard, Library, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/exercises", label: "Exercises", icon: Library },
  { href: "/dashboard/routines", label: "Routines", icon: Dumbbell },
  { href: "/dashboard/progress", label: "Progress", icon: BarChart3 }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-dvh w-full flex-col border-r bg-card px-4 py-5 md:w-64">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
        Sthenos
      </Link>
      <nav className="grid gap-1">
        {links.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-elevated hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="mt-auto pt-6">
        <SubmitButton
          variant="ghost"
          className="w-full justify-start"
          pendingLabel="Logging out..."
        >
          Log out
        </SubmitButton>
      </form>
    </aside>
  );
}
