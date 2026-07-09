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
      <div className={cn("flex aspect-video items-center justify-center rounded-md bg-muted text-muted-foreground", className)}>
        <ImageIcon className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("aspect-video rounded-md object-cover", className)}
    />
  );
}
