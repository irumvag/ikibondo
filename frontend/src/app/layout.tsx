import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/layout/Providers";
import { LocaleSync } from "@/components/layout/LocaleSync";
import { THEME_SCRIPT } from "@/lib/theme";

// One family for the whole product: Atkinson Hyperlegible was designed for
// low-vision legibility, which matters for CHWs reading cheap phones in sunlight.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ikibondo — Child Health Platform",
    template: "%s | Ikibondo",
  },
  description:
    "Child nutrition and health monitoring for displacement camps in Rwanda.",
  keywords: ["child health", "nutrition", "Rwanda", "refugee camps", "malnutrition"],
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: { apple: '/apple-touch-icon.png' },
  // Lets "Add to Home Screen" on iPhone open as a standalone app
  appleWebApp: { capable: true, title: 'Ikibondo', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#16324F',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Blocking theme script — runs before CSS paint to prevent flash */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body
        className={`${atkinson.variable} font-sans antialiased`}
        style={{
          fontFamily: "var(--font-atkinson), system-ui, sans-serif",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <NextIntlClientProvider>
          <Providers>
            <LocaleSync />
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`,
          }}
        />
      </body>
    </html>
  );
}
