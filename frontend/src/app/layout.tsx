import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { THEME_SCRIPT } from "@/lib/theme";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ikibondo — Child Health Platform",
    template: "%s | Ikibondo",
  },
  description:
    "Child nutrition and health monitoring for displacement camps in Rwanda.",
  keywords: ["child health", "nutrition", "Rwanda", "UNHCR", "malnutrition"],
  robots: { index: false, follow: false }, // private health system
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking theme script — runs before CSS paint to prevent flash */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${inter.variable} font-sans antialiased`}
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
