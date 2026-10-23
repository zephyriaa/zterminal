import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/terminal/terminal-glass.css";
import "@/components/terminal/terminal-motion.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060914",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zterminal.dpdns.org"),
  title: "ZTerminal — See Further. Guess Less.",
  description:
    "See Further. Guess Less. A market research workspace for charting, Python strategy research, backtesting, and evidence-led decisions.",
  keywords: [
    "Z Terminal",
    "quantitative trading",
    "Python backtesting",
    "backtesting",
    "market data",
    "market research terminal",
    "order flow",
  ],
  authors: [{ name: "Z Terminal" }],
  icons: { icon: "/brand/favicon.ico", shortcut: "/brand/favicon-32x32.png", apple: "/brand/apple-touch-icon.png" },
  manifest: "/brand/site.webmanifest",
  openGraph: { images: [{ url: "/brand/zterminal-og-dark-1200x630.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/brand/zterminal-og-dark-1200x630.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* OpenNext/Workers can evaluate next-themes' inline helper before esbuild's
            generated __name shim is present. Keep the helper harmlessly available
            so theme hydration does not emit a browser console error at the edge. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "globalThis.__name=globalThis.__name||((fn)=>fn);",
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
