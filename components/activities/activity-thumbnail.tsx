import { Footprints } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityThumbnailProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function ActivityThumbnail({ src, alt, className }: ActivityThumbnailProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-md bg-muted text-muted-foreground",
          className
        )}
      >
        <Footprints className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn(
        "aspect-video rounded-md bg-background-secondary object-contain",
        className
      )}
    />
  );
}
