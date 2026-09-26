import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Orbit Portal",
  description: "One login for all Orbit products — WorkPipe, Atrium, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      waitlistUrl="/waitlist"
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#2B2FFF",
          colorBackground: "#0f0f13",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-[#0f0f13] text-white min-h-screen antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
