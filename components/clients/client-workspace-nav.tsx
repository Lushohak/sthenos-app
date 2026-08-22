import Link from "next/link";
import { Activity, BarChart3, History, LayoutDashboard, UserRound } from "lucide-react";
import {
  clientWorkspaceHref,
  type ClientWorkspaceTab
} from "@/lib/client-workspace";
import { cn } from "@/lib/utils";

const tabs: Array<{
  id: ClientWorkspaceTab;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "training", label: "Training plan", icon: Activity },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "account", label: "Account", icon: UserRound }
];

export function ClientWorkspaceNav({
  clientId,
  activeTab
}: {
  clientId: string;
  activeTab: ClientWorkspaceTab;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-y bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <nav aria-label="Client workspace" className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-lg bg-card p-1 shadow-soft">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={clientWorkspaceHref(clientId, tab.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-elevated hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
