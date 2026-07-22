"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
  duration?: number;
};

const variants = {
  success: {
    icon: CheckCircle2,
    className: "border-primary/30",
    iconClassName: "text-primary"
  },
  error: {
    icon: AlertCircle,
    className: "border-destructive/30",
    iconClassName: "text-destructive"
  },
  info: {
    icon: Info,
    className: "border-border",
    iconClassName: "text-foreground"
  }
};

export function Toast({
  open,
  onOpenChange,
  title,
  description,
  variant = "success",
  duration = 4500
}: ToastProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open || duration <= 0) return;

    const timeoutId = window.setTimeout(() => onOpenChange(false), duration);
    return () => window.clearTimeout(timeoutId);
  }, [duration, onOpenChange, open]);

  if (!isMounted || !open) return null;

  const appearance = variants[variant];
  const Icon = appearance.icon;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-2xl",
          appearance.className
        )}
        role={variant === "error" ? "alert" : "status"}
        aria-live={variant === "error" ? "assertive" : "polite"}
      >
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", appearance.iconClassName)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="-mr-2 -mt-2 h-8 w-8 shrink-0 px-0"
          aria-label="Dismiss notification"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>,
    document.body
  );
}
