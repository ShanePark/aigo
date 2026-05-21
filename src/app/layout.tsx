import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned } from "lucide-react";

import "./globals.css";

export const metadata: Metadata = {
  title: "AiGo",
  description: "아이 동반 장소 검색 MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <MapPinned size={20} aria-hidden="true" />
            <span>AiGo</span>
          </Link>
          <span className="topbar-note">대전 + 1시간권 장소 데이터베이스</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

