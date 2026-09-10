import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ZTerminalSessionProvider } from "@/components/auth/session-provider";
import { SmoothScrollProvider } from "@/components/motion/smooth-scroll-provider";

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
  title: "ZTerminal — Institutional Quantitative Trading Workstation",
  description:
    "Institutional-grade quantitative workstation for systematic traders. Sub-second backtesting, real-time market structure, and disciplined risk execution with total strategy privacy.",
  keywords: [
    "Z Terminal",
    "quantitative trading",
    "futures",
    "backtesting",
    "market data",
    "research terminal",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ZTerminalSessionProvider>
            <SmoothScrollProvider>
              {children}
            </SmoothScrollProvider>
            <Toaster />
          </ZTerminalSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
