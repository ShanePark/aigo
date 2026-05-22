import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "AiGo",
  description: "아이 동반 장소 검색 MVP",
  applicationName: "AiGo",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"]
  }
};

export const viewport: Viewport = {
  themeColor: "#1f8a63"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <Image className="brand-icon" src="/icons/icon-32.png" alt="" width={28} height={28} priority aria-hidden="true" />
            <span>AiGo</span>
          </Link>
          <span className="topbar-note">대전 + 1시간권 장소 데이터베이스</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
