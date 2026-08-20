import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voice RAG · Hacker House Goa 2026 · Task 2",
  description:
    "Sub-50ms Voice-Enabled Retrieval-Augmented Generation on MSMARCO-XI with Sarvam AI. Hacker House Goa 2026 Task 2.",
  keywords: [
    "HH Goa 2026",
    "Hacker House Goa",
    "Voice RAG",
    "MSMARCO-XI",
    "Sarvam AI",
    "Saaras v3",
    "Retrieval Augmented Generation",
  ],
  authors: [{ name: "HH Goa 2026" }],
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/logo.svg"],
    apple: ["/logo.svg"],
  },
  openGraph: {
    title: "Voice RAG · Hacker House Goa 2026 · Task 2",
    description:
      "Sub-50ms Voice-Enabled Retrieval-Augmented Generation on MSMARCO-XI with Sarvam AI.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voice RAG · HH Goa 2026 · Task 2",
    description: "Sub-50ms Voice RAG with Sarvam AI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="hhgoa-theme"
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
