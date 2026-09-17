import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  icons: { icon: "/brand/zterminal-mark-v2.png", shortcut: "/brand/zterminal-mark-v2.png", apple: "/brand/zterminal-mark-v2.png" },
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
