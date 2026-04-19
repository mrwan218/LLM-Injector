import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Injector",
  description:
    "Natural language interface for LLM-powered file system operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
