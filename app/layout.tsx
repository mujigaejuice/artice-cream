import type { Metadata, Viewport } from "next";

import { BackgroundMusic } from "@/components/BackgroundMusic";
import { ReadingExitNotice } from "@/components/ReadingExitNotice";

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
        <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">
          <BackgroundMusic />
          <ReadingExitNotice>{children}</ReadingExitNotice>
        </div>
      </body>
    </html>
  );
}
