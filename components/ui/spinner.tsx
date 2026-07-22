import { LoaderCircle, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = LucideProps & {
  label?: string;
};

export function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <LoaderCircle
      className={cn("h-5 w-5 animate-spin", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    />
  );
}
