import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Architect",
  description: "A personal study tracker built on time, not checkboxes.",
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
