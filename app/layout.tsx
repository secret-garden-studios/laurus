import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laurus",
  description: "the first tree in a secret garden",
  icons: {
    icon: 'laurus-logo-placeholder.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
          {children}
      </body>
    </html>
  );
}
