"use client";

import Link from "next/link";
import { House, TrendingUp, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/trainee", label: "Home", icon: House },
  { href: "/trainee/progress", label: "Progress", icon: TrendingUp },
  { href: "/trainee/peers", label: "Peers", icon: Users }
];

export function TraineeNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Trainee navigation" className="overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/trainee"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
