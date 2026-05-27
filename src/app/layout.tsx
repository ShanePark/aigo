import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import "./globals.css";
import { GoogleAnalytics } from "./google-analytics";
import { TopbarActions } from "./topbar-actions";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialUser = await getInitialUser();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <GoogleAnalytics />
        <header className="topbar">
          <Link className="brand" href="/">
            <Image className="brand-icon" src="/icons/icon-32.png" alt="" width={28} height={28} priority aria-hidden="true" />
            <span>AiGo</span>
          </Link>
          <TopbarActions footerText={`© ${currentYear} AiGo · Shane Park`} initialUser={initialUser} />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

async function getInitialUser() {
  try {
    const cookieStore = await cookies();
    return currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);
  } catch (error) {
    console.warn("Failed to load initial account state", error);
    return null;
  }
}
