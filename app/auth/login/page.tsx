import { AuthForm } from "@/components/forms/auth-form";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-md border bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage clients, routines, and progress.</p>
        <div className="mt-6">
          <AuthForm mode="login" error={params?.error} />
        </div>
      </section>
    </main>
  );
}
