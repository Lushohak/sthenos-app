import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ExerciseThumbProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function ExerciseThumb({ src, alt, className }: ExerciseThumbProps) {
  if (!src) {
    return (
      <div className={cn("flex aspect-square items-center justify-center rounded-md bg-muted text-muted-foreground", className)}>
        <ImageIcon className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("aspect-square rounded-md object-cover", className)}
    />
  );
}
