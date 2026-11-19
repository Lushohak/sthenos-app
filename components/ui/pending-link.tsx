"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ComponentProps, type MouseEvent } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type PendingLinkProps = ComponentProps<typeof Link> & {
  pendingLabel?: string;
  spinnerClassName?: string;
};

export function PendingLink({
  children,
  className,
  href,
  onClick,
  pendingLabel = "Loading page",
  replace,
  scroll,
  spinnerClassName,
  ...props
}: PendingLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.currentTarget.target === "_blank" ||
      event.currentTarget.hasAttribute("download")
    ) {
      return;
    }

    const destination = new URL(event.currentTarget.href, window.location.href);
    const current = new URL(window.location.href);

    if (destination.origin !== current.origin) return;
    if (
      destination.pathname === current.pathname &&
      destination.search === current.search &&
      destination.hash === current.hash
    ) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;

    startTransition(() => {
      if (replace) {
        router.replace(nextUrl, { scroll });
      } else {
        router.push(nextUrl, { scroll });
      }
    });
  }

  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      className={cn(isPending && "pointer-events-none", className)}
      aria-busy={isPending || undefined}
      onClick={handleClick}
    >
      {children}
      {isPending ? (
        <Spinner
          className={cn("h-3.5 w-3.5 shrink-0", spinnerClassName)}
          label={pendingLabel}
        />
      ) : null}
    </Link>
  );
}
