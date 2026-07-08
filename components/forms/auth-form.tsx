import Link from "next/link";
import { loginAction, signUpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type AuthFormProps = {
  mode: "login" | "sign-up";
  error?: string;
};

export function AuthForm({ mode, error }: AuthFormProps) {
  const isSignUp = mode === "sign-up";

  return (
    <form action={isSignUp ? signUpAction : loginAction} className="grid gap-4">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-white px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {isSignUp ? (
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={6} />
      </Field>
      <Button type="submit">{isSignUp ? "Create account" : "Log in"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link className="font-medium text-primary" href={isSignUp ? "/auth/login" : "/auth/sign-up"}>
          {isSignUp ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
