import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProductOS - Product Manager AI Assistant",
  description: "AI-powered product management assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

