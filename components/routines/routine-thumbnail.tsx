import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type RoutineThumbnailProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function RoutineThumbnail({
  src,
  alt,
  className
}: RoutineThumbnailProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-md bg-muted text-muted-foreground",
          className
        )}
      >
        <Activity className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("aspect-video rounded-md object-cover", className)}
    />
  );
}
