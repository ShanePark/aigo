import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";

import "./globals.css";
import { TopbarActions } from "./topbar-actions";
import { isDevLoginEnabled } from "@/lib/app-auth";

const currentYear = new Date().getFullYear();

const themeInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("aigo-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1512" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <Image className="brand-icon" src="/icons/icon-32.png" alt="" width={28} height={28} priority aria-hidden="true" />
            <span>AiGo</span>
          </Link>
          <TopbarActions devLoginEnabled={isDevLoginEnabled()} />
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>© {currentYear} AiGo. All rights reserved.</p>
          <p>Developed by Shane Park 개발자</p>
        </footer>
      </body>
    </html>
  );
}
