import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Architect",
  description: "A personal study tracker built on time, not checkboxes.",
  manifest: "/manifest.json",
  themeColor: "#111111",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
