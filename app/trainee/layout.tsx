import Link from "next/link";
import { Activity, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";

export default function TraineeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/trainee" className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            Sthenos
          </Link>
          <form action={logoutAction}>
            <SubmitButton variant="ghost" pendingLabel="Logging out...">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </SubmitButton>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
