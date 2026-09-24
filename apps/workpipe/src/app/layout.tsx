import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Toaster as SonnarToaster } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import ModalProvider from '@/providers/modal-provider'
import { ThemeProvider } from '@/providers/theme-provider'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'WorkPipe',
  description: 'All in one Business Solution',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
      <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ModalProvider>
            {children}
            <Toaster />
            <SonnarToaster position="bottom-left" />
            </ModalProvider>
        </ThemeProvider>
        </body>
    </html>
  );
}
