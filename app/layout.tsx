import type { Metadata, Viewport } from "next";

import { BackgroundMusic } from "@/components/BackgroundMusic";
import { PageFrame } from "@/components/PageFrame";
import { ReadingExitNotice } from "@/components/ReadingExitNotice";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: "artice cream",
  description: "오늘의 뉴스를 내 수준에 맞게. 읽을 때마다 콘에 스쿱이 쌓여요.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "artice cream" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        {/* 음악 재생기는 상단 바 안에 하나만 둔다. 화면을 옮겨도 다시 만들어지지 않는다. */}
        <SiteHeader><BackgroundMusic /></SiteHeader>
        <PageFrame>
          <ReadingExitNotice>{children}</ReadingExitNotice>
        </PageFrame>
      </body>
    </html>
  );
}
