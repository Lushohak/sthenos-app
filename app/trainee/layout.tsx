import Link from "next/link";
import { LogOut } from "lucide-react";
import { SthenosMark } from "@/components/brand/sthenos-logo";
import { logoutAction } from "@/lib/actions/auth";
import { TraineeNav } from "@/components/trainee/trainee-nav";
import { SubmitButton } from "@/components/ui/submit-button";

export default function TraineeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/trainee" className="flex items-center gap-2.5 text-lg font-semibold">
            <SthenosMark priority />
            Sthenos
          </Link>
          <div className="hidden sm:block">
            <TraineeNav />
          </div>
          <form action={logoutAction}>
            <SubmitButton variant="ghost" pendingLabel="Logging out...">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sr-only sm:hidden">Log out</span>
            </SubmitButton>
          </form>
        </div>
        <div className="border-t px-4 py-2 sm:hidden">
          <TraineeNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
