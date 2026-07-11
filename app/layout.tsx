import type { Metadata } from "next";
import "./globals.css";
import { dellaRespira } from "./fonts";

export const metadata: Metadata = {
  title: "Laurus",
  description: "The first tree in a secret garden",
  icons: {
    icon: "laurus-logo-italiana-dark-144.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dellaRespira.variable}>
      <body className={dellaRespira.className}>{children}</body>
    </html>
  );
}
