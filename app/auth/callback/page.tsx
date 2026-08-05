import { Suspense } from "react";
import { AuthCallback } from "@/components/auth/auth-callback";
import { SthenosLogo } from "@/components/brand/sthenos-logo";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-md border bg-card p-6 text-center shadow-soft">
        <SthenosLogo className="mx-auto mb-5" priority />
        <h1 className="text-2xl font-semibold">Finishing sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">You will be redirected in a moment.</p>
        <Suspense fallback={null}>
          <AuthCallback />
        </Suspense>
      </section>
    </main>
  );
}
