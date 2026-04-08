import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Okostankonyv",
  description: "Privat, forraskotott AI-tamogatott tanulofelulet csaladi hasznalatra.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
