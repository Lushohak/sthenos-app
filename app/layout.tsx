import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sthenos",
  description: "Workout management for fitness coaches"
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
