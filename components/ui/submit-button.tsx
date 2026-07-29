"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "type"
> & {
  children: ReactNode;
  pendingLabel: string;
  pendingText?: string | null;
};

export function SubmitButton({
  children,
  disabled,
  pendingLabel,
  pendingText,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const visiblePendingText =
    pendingText === undefined ? pendingLabel : pendingText;

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? (
        <>
          <Spinner
            className="h-4 w-4"
            label={visiblePendingText === null ? pendingLabel : undefined}
          />
          {visiblePendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
