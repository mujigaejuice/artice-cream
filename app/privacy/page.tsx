import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | artice cream",
  description: "artice cream의 계정·학습 기록 보관, 삭제 및 개인정보 문의 안내입니다.",
  // 실제 제공사 설정을 반영한 확정본으로 전환할 때 해제한다.
  robots: { index: false, follow: false },
};

const sections = [
  { id: "data", title: "어떤 정보를 사용하나요?" },
  { id: "retention", title: "언제까지 보관하나요?" },
  { id: "providers", title: "외부 서비스와 기기 저장" },
  { id: "rights", title: "내 정보 확인과 삭제" },
  { id: "age", title: "가입 연령" },
  { id: "contact", title: "문의하기" },
];

/** 로그인과 API 조회 없이 웹·앱 정적 번들에서 모두 읽을 수 있는 안내 화면. */
export default function PrivacyPage() {
  return (
    <main className="text-stone-800">
      <Link href="/onboarding/" className="ac-intro-link text-stone-600">서비스 소개로</Link>
      <p className="mt-7 text-sm font-semibold text-stone-500">artice cream</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-4 text-sm leading-7 text-stone-600">운영자 무지개쥬스가 계정과 학습 기록을 어떻게 다루는지 안내해요. 로그인하지 않아도 이 페이지를 읽을 수 있어요.</p>

      <aside aria-label="초안 안내" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">공개 전 검토 중인 초안이에요.</p>
        <p className="mt-2">제공사의 로그·백업 보관기간, 인증 메일 발송 업체, 국외 이전 상세와 시행일은 아직 확정되지 않았어요. 아래는 현재 구현과 정해진 운영 방침을 정리한 내용이며, 확정된 처리방침은 아니에요.</p>
      </aside>

      <nav aria-label="개인정보 안내 목차" className="my-8 border-y border-stone-200 py-3">
        {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="ac-intro-link w-full text-stone-600">{section.title}</a>)}
      </nav>

      <div className="space-y-9 text-sm leading-7 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-stone-900 [&_p]:mt-3 [&_section]:scroll-mt-6">
        <section id="data" aria-labelledby="data-title">
          <h2 id="data-title">어떤 정보를 사용하나요?</h2>
          <dl className="mt-3 space-y-4">
            <div><dt className="font-semibold">가입과 로그인</dt><dd className="text-stone-600">이메일, 계정 식별정보, 로그인 제공자와 인증 세션을 사용해요. Google 로그인을 선택하면 해당 제공자가 전달하는 계정 정보도 처리해요. 서비스에서 별도 비밀번호를 입력받지 않아요.</dd></div>
            <div><dt className="font-semibold">읽기와 내 콘</dt><dd className="text-stone-600">관심 분야·읽기 수준, 읽은 글, 퀴즈 답안·점수, 저장 상태와 시각을 보관해요. 읽기 수준을 조정하고 같은 글의 중복 저장을 막는 데 사용해요.</dd></div>
            <div><dt className="font-semibold">이용량 관리</dt><dd className="text-stone-600">일일 열람 사용량과 추가 열람 요청·처리 기록을 사용해요.</dd></div>
            <div><dt className="font-semibold">개인정보 문의</dt><dd className="text-stone-600">문의 이메일과 내용을 받고, 요청 처리에 필요한 최소한의 본인 확인을 할 수 있어요. 문의 기록의 보관기간은 확정 전이에요.</dd></div>
          </dl>
        </section>

        <section id="retention" aria-labelledby="retention-title">
          <h2 id="retention-title">언제까지 보관하나요?</h2>
          <dl className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white px-4">
            <div className="py-4"><dt className="font-semibold">계정·학습·저장 기록</dt><dd className="mt-1 text-stone-600">탈퇴 또는 서비스 종료 시까지 보관해요. 본인 확인과 최종 삭제 요청 후 서비스 운영 데이터에서 바로 삭제해요.</dd></div>
            <div className="py-4"><dt className="font-semibold">일일 이용량·추가 열람 기록</dt><dd className="mt-1 text-stone-600">30일이 지난 기록을 매일 정리하는 정책이에요. 날짜로 관리하는 기록은 한국 시간 기준으로 정리해요. 탈퇴하면 기간에 관계없이 함께 삭제해요.</dd></div>
            <div className="py-4"><dt className="font-semibold">제공사 로그·백업</dt><dd className="mt-1 text-stone-600">운영 데이터와 별도로 관리돼요. 실제 보관기간과 삭제 반영 절차를 확인 중이며, 탈퇴와 동시에 모든 사본이 삭제된다고 보장하지 않아요.</dd></div>
          </dl>
        </section>

        <section id="providers" aria-labelledby="providers-title">
          <h2 id="providers-title">외부 서비스와 기기 저장</h2>
          <p>Supabase를 계정 인증·데이터 저장에, Vercel을 웹·API 호스팅에 사용해요. 로그인 유지를 위해 브라우저 또는 앱 저장 공간에 인증 세션을 보관해요. 로그아웃하면 현재 기기의 로그인 상태가 해제돼요.</p>
          <p>수탁자 법인·처리 국가, 인증 이메일 발송 업체, Google이 전달하는 정보 범위, 접속·보안 로그 항목과 보관기간 등은 실제 설정을 확인해 확정본에 반영할 예정이에요.</p>
        </section>

        <section id="rights" aria-labelledby="rights-title">
          <h2 id="rights-title">내 정보 확인과 삭제</h2>
          <p>정보의 열람·정정·삭제·처리정지와 동의 철회는 아래 이메일로 요청할 수 있어요. 계정 삭제 페이지에서는 앱을 설치하지 않고도 본인 확인 후 직접 탈퇴할 수 있어요.</p>
          <p>탈퇴하면 계정과 프로필, 관심 분야·수준, 퀴즈·읽기·저장 기록, 내 콘과 이용량 기록이 함께 삭제돼요. 이메일 확인만으로 탈퇴되지는 않으며 마지막 삭제 확인이 필요해요. 삭제한 기록은 복구할 수 없어요.</p>
          <Link href="/account/delete/" className="ac-intro-link mt-2 font-semibold">계정 및 데이터 삭제 안내</Link>
        </section>

        <section id="age" aria-labelledby="age-title">
          <h2 id="age-title">가입 연령</h2>
          <p>회원 가입은 만 14세 이상부터 가능해요. 로그인 화면에서 직접 확인하며 생년월일이나 신분증 사본은 수집하지 않아요. 만 14세 미만의 가입 사실을 알게 되면 필요한 최소 범위에서 확인하고 해당 계정과 개인정보를 삭제해요.</p>
        </section>

        <section id="contact" aria-labelledby="contact-title">
          <h2 id="contact-title">문의하기</h2>
          <p>운영자: 무지개쥬스<br /><a href="mailto:mujigaejuice@gmail.com" className="ac-intro-link break-all underline">mujigaejuice@gmail.com</a></p>
          <p className="text-stone-600">개인정보 보호책임자 표기와 방침 시행일·변경 안내 절차는 확정본에 반영할 예정이에요.</p>
        </section>
      </div>
      <footer className="mt-10 border-t border-stone-200 pt-4">
        <Link href="/onboarding/?step=login" className="ac-intro-link">로그인 화면으로</Link>
      </footer>
    </main>
  );
}
