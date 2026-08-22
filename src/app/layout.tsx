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
  title: "ZTerminal — Evidence-led market research",
  description:
    "Quantitative market research and decision support for traders who want to test ideas, define risk, and keep control of the decision.",
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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
