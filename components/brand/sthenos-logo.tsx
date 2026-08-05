import Image from "next/image";
import { STHENOS_BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  priority?: boolean;
};

export function SthenosMark({ className, priority = false }: LogoProps) {
  return (
    <Image
      src={STHENOS_BRAND.assets.appIcon192}
      alt=""
      width={192}
      height={192}
      sizes="32px"
      className={cn("h-8 w-8 shrink-0 rounded-lg", className)}
      priority={priority}
      aria-hidden="true"
    />
  );
}

export function SthenosLogo({ className, priority = false }: LogoProps) {
  return (
    <Image
      src={STHENOS_BRAND.assets.fullLogo}
      alt="Sthenos"
      width={1254}
      height={1254}
      sizes="(min-width: 640px) 160px, 144px"
      className={cn("h-auto w-36 sm:w-40", className)}
      priority={priority}
    />
  );
}
