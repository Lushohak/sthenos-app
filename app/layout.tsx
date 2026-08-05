import type { Metadata } from "next";
import { STHENOS_BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: STHENOS_BRAND.name,
  description: STHENOS_BRAND.description,
  applicationName: STHENOS_BRAND.name,
  icons: {
    icon: [
      {
        url: STHENOS_BRAND.assets.favicon,
        sizes: "32x32",
        type: "image/png"
      },
      {
        url: STHENOS_BRAND.assets.appIcon192,
        sizes: "192x192",
        type: "image/png"
      }
    ],
    apple: [
      {
        url: STHENOS_BRAND.assets.appleTouchIcon,
        sizes: "180x180",
        type: "image/png"
      }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
