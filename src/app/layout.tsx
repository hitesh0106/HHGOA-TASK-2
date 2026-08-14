import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  title: "Voice RAG · HH Goa 2026 · AI Lab",
  description:
    "Voice-enabled retrieval-augmented generation, grounded in real knowledge. Hacker House Goa 2026 Task 2 — AI Lab.",
  keywords: [
    "HH Goa 2026",
    "Hacker House Goa",
    "Voice RAG",
    "MSMARCO-XI",
    "Sarvam",
    "AI4Bharat",
    "Retrieval Augmented Generation",
  ],
  authors: [{ name: "HH Goa 2026" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Voice RAG · HH Goa 2026 · AI Lab",
    description:
      "Voice-enabled retrieval-augmented generation, grounded in real knowledge.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voice RAG · HH Goa 2026",
    description: "Voice-enabled retrieval-augmented generation.",
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
        className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
