"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishAuth() {
      const supabase = createClient();
      const next = getSafeRedirectPath(searchParams.get("next"));
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      setError("The invite link is missing its login token. Please ask your coach to resend it.");
    }

    finishAuth();
  }, [router, searchParams]);

  if (!error) {
    return null;
  }

  return (
    <p className="mt-4 rounded-md border border-destructive/25 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}
