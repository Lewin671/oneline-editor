import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Online Editor",
  description: "A modern online code editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const setInitialTheme = `
    (function() {
      try {
        const stored = localStorage.getItem('theme-preference');
        const mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        document.documentElement.style.colorScheme = resolved;
      } catch (e) {
        console.warn('Failed to set initial theme', e);
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable,
        )}
      >
        <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
        {children}
      </body>
    </html>
  );
}
