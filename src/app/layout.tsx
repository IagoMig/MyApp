import type { Metadata, Viewport } from "next";
import "./globals.css";
import { allFontVariables } from "@/lib/fonts";
import { AmbientBackdrop } from "@/components/Glass";
import { BottomNav } from "@/components/BottomNav";
import { PwaRegistrar } from "@/components/PwaRegistrar";

export const metadata: Metadata = {
  title: "My App",
  description: "Rotina pessoal minimalista em glassmorfismo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My App",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${allFontVariables} dark`}>
      <body className="bg-black text-white antialiased selection:bg-white/25 selection:text-white">
        <PwaRegistrar />
        <AmbientBackdrop />
        <main className="relative mx-auto min-h-dvh w-full max-w-[460px] px-4 safe-top safe-bottom-pad">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
