import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const styles = {
  primary:
    "border border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover active:border-primary-pressed active:bg-primary-pressed",
  secondary:
    "border border-border-emphasis bg-elevated text-foreground hover:border-secondary hover:bg-secondary/20 active:bg-secondary/30",
  ghost:
    "border border-transparent text-muted-foreground shadow-none hover:bg-elevated hover:text-foreground active:bg-secondary/20",
  danger:
    "border border-destructive bg-destructive text-primary-foreground hover:bg-destructive/90 active:bg-destructive/80"
};

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:border-border disabled:bg-elevated disabled:text-disabled-foreground disabled:shadow-none";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(base, styles[variant], className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof styles;
};

export function LinkButton({
  className,
  variant = "primary",
  href,
  ...props
}: LinkButtonProps) {
  return <Link className={cn(base, styles[variant], className)} href={href} {...props} />;
}
