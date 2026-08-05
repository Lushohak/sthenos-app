import type { MetadataRoute } from "next";
import { STHENOS_BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: STHENOS_BRAND.name,
    short_name: STHENOS_BRAND.shortName,
    description: STHENOS_BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: STHENOS_BRAND.themeColor,
    theme_color: STHENOS_BRAND.themeColor,
    icons: [
      {
        src: STHENOS_BRAND.assets.appIcon192,
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: STHENOS_BRAND.assets.appIcon512,
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: STHENOS_BRAND.assets.appIcon1024,
        sizes: "1024x1024",
        type: "image/png"
      }
    ]
  };
}
