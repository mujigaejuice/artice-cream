import { TabBar } from "@/components/TabBar";

/**
 * 탭 셸. 푸터가 필요한 화면만 이 route group 안에 둔다 —
 * 리더·퀴즈·온보딩은 바깥이라 조건부 렌더링이 필요 없다.
 */
export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 탭 바(h-14) + 세이프에어리어만큼 본문 아래를 비운다. */}
      <div style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </div>
      <TabBar />
    </>
  );
}
