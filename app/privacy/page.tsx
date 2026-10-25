import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | artice cream",
  description: "artice cream의 계정·학습 기록 보관, 삭제 및 개인정보 문의 안내입니다.",
  // 국외 이전·제공사 잔존 사본 처리를 확인한 뒤 시행일과 함께 변경한다.
  robots: { index: false, follow: false },
};

const sections = [
  { id: "contact", title: "운영자와 개인정보 보호책임자" },
  { id: "data", title: "어떤 정보를 사용하나요?" },
  { id: "credits", title: "크레딧 기록" },
  { id: "retention", title: "언제까지 보관하나요?" },
  { id: "deletion", title: "파기 절차와 방법" },
  { id: "providers", title: "외부 서비스와 처리위탁" },
  { id: "transfers", title: "제3자 제공과 국외 이전" },
  { id: "device", title: "기기에 저장하는 정보" },
  { id: "ai", title: "AI 콘텐츠와 읽기 수준 조정" },
  { id: "rights", title: "내 정보 확인과 삭제" },
  { id: "age", title: "가입 연령" },
  { id: "security", title: "개인정보 보호 조치" },
  { id: "changes", title: "시행일과 변경 안내" },
];

/** 로그인과 API 조회 없이 웹·앱 정적 번들에서 모두 읽을 수 있는 안내 화면. */
export default function PrivacyPage() {
  return (
    <main className="text-stone-800">
      <Link href="/onboarding/" className="ac-intro-link text-stone-600">서비스 소개로</Link>
      <p className="mt-7 text-sm font-semibold text-stone-500">artice cream</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-4 text-sm leading-7 text-stone-600">무지개쥬스가 운영하는 artice cream 웹과 Android 앱의 개인정보 처리에 관한 안내입니다. 로그인하지 않아도 읽을 수 있습니다.</p>

      <aside aria-label="초안 안내" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">공개 전 최종 확인 중인 초안입니다.</p>
        <p className="mt-2">운영자·책임자와 서비스 기록의 보관 기준을 정했습니다. 외부 제공사의 국외 이전 범위와 로그·백업 사본의 삭제 조건은 확인 중입니다. 이 문서는 아직 시행된 확정본이 아닙니다.</p>
      </aside>

      <nav aria-label="개인정보 안내 목차" className="my-8 border-y border-stone-200 py-3">
        {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="ac-intro-link w-full text-stone-600">{section.title}</a>)}
      </nav>

      <div className="space-y-9 text-sm leading-7 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-stone-900 [&_p]:mt-3 [&_section]:scroll-mt-6">
        <section id="contact" aria-labelledby="contact-title">
          <h2 id="contact-title">운영자와 개인정보 보호책임자</h2>
          <p>운영자: 무지개쥬스<br />개인정보 보호책임자: 이시하<br />문의·권리 행사: <a href="mailto:mujigaejuice@gmail.com" className="ac-intro-link break-all underline">mujigaejuice@gmail.com</a></p>
          <p>개인정보에 관한 문의와 열람·정정·삭제·처리정지·동의 철회 요청은 위 이메일로 접수합니다. 계정은 <Link href="/account/delete/" className="underline">계정 및 데이터 삭제 페이지</Link>에서도 직접 삭제할 수 있습니다.</p>
        </section>

        <section id="data" aria-labelledby="data-title">
          <h2 id="data-title">어떤 정보를 사용하나요?</h2>
          <p>가입·학습 기능에 필요한 정보는 이용자의 서비스 이용 요청과 계약 이행을 위해 처리합니다. Google 로그인을 선택하지 않아도 이메일로 로그인할 수 있습니다.</p>
          <dl className="mt-3 space-y-4">
            <div><dt className="font-semibold">가입·로그인·본인 확인</dt><dd className="text-stone-600">이메일, 서비스 사용자 ID, 로그인 제공자와 제공자 계정 식별정보, 가입·인증 시각, 인증 상태와 세션 정보를 처리합니다. 이메일 인증번호 또는 Google 로그인 과정에서 수집하며, 서비스 자체 비밀번호는 받지 않습니다.</dd></div>
            <div><dt className="font-semibold">Google 로그인 선택 시</dt><dd className="text-stone-600">Google에서 이메일, 계정 식별정보, 이름, 프로필 사진 URL과 인증 관련 정보를 전달받아 인증 시스템에 저장합니다. 이용자의 이름이나 사진을 다른 회원에게 공개하지 않습니다.</dd></div>
            <div><dt className="font-semibold">관심 분야·읽기 수준</dt><dd className="text-stone-600">선택 분야, 초기·현재 읽기 수준, 최근 퀴즈 점수와 평균 정답률, 응시 수, 갱신 시각을 처리합니다. 처음 용어를 확인할 때 선택한 개별 용어 목록은 서버에 저장하지 않고 분야와 산출된 수준을 저장합니다.</dd></div>
            <div><dt className="font-semibold">읽기·퀴즈·콘 저장</dt><dd className="text-stone-600">계정과 연결된 기사·본문 식별자, 읽기 상태, 퀴즈 답안·점수, 시작·완료·저장 시각을 처리합니다. 학습 기록과 콘 표시, 중복 저장 방지와 재열람에 사용합니다. 반복 풀이는 최초 완료 기록을 덮어쓰지 않습니다.</dd></div>
            <div><dt className="font-semibold">일일 이용량·추가 열람</dt><dd className="text-stone-600">사용자 ID, 이용 날짜, 무료 열람 사용 여부, 추가 열람 횟수, 요청 식별값·검증 결과·생성 시각을 처리합니다. 현재 추가 열람 기능에는 실제 광고 SDK가 연결되어 있지 않습니다.</dd></div>
            <div><dt className="font-semibold">접속·보안·장애 대응</dt><dd className="text-stone-600">호스팅·인증 서비스에서 접속 IP 주소, 요청 시각·경로·응답 상태, 브라우저·기기 관련 요청 정보, 인증 및 오류 기록을 처리할 수 있습니다. 요청 처리, 부정한 접근 방지와 장애 확인에 사용하며 제공사별 세부 범위는 최종 확인 중입니다.</dd></div>
            <div><dt className="font-semibold">문의·권리 행사</dt><dd className="text-stone-600">문의 이메일, 내용·첨부파일, 처리 내역과 본인 또는 대리인 확인에 필요한 최소 정보를 처리합니다. 요청 이행과 관련 의무 준수를 위해 사용합니다. 신분증 사본이나 주민등록번호를 기본 제출 항목으로 요구하지 않으며, 문의에 불필요한 민감정보를 넣지 마세요.</dd></div>
          </dl>
          <p>계정·학습에 필요한 정보를 제공하지 않으면 해당 기능의 이용이 제한됩니다. 서비스 소개, 이 방침과 계정 삭제 안내는 가입 없이 읽을 수 있습니다.</p>
        </section>

        <section id="credits" aria-labelledby="credits-title">
          <h2 id="credits-title">크레딧 기록</h2>
          <p>학습 보상을 계산하고 잔액과 내역을 보여주기 위해 계정 ID, 지급·사용 금액과 사유, 관련 학습 ID, 정책 버전, 기록 시각을 저장합니다. 퀴즈 답안이나 이메일은 크레딧 원장에 복제하지 않습니다.</p>
          <p>크레딧은 계정에 연결되며 계정과 데이터 삭제가 완료되면 원장 기록도 함께 삭제됩니다. 별도의 만료일이나 월별 초기화는 적용하지 않습니다.</p>
          <p>꾸미기를 구매하면 상품 ID와 구매 거래, 구매 시각을 저장하고, 적용한 꾸미기의 슬롯과 상품 ID를 저장합니다. 계정 삭제 시 보유·적용 기록도 함께 삭제합니다.</p>
        </section>
        <section id="retention" aria-labelledby="retention-title">
          <h2 id="retention-title">언제까지 보관하나요?</h2>
          <dl className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white px-4">
            <div className="py-4"><dt className="font-semibold">계정·프로필·분야·학습·콘 기록</dt><dd className="mt-1 text-stone-600">탈퇴 또는 서비스 종료 시까지 보관합니다. 본인 확인과 최종 삭제 요청이 정상 처리되면 서비스 운영 데이터에서 삭제합니다.</dd></div>
            <div className="py-4"><dt className="font-semibold">일일 이용량·추가 열람 기록</dt><dd className="mt-1 text-stone-600">30일이 지난 기록을 매일 정리합니다. 날짜 단위 이용량은 한국 시간 기준 30일 전 날짜보다 오래된 기록부터, 시각 단위 추가 열람은 30일이 지난 기록부터 삭제합니다. 정확히 30일이 되는 순간이 아니라 이후 정기 정리 때 삭제됩니다. 탈퇴 시에는 기간과 무관하게 함께 삭제합니다.</dd></div>
            <div className="py-4"><dt className="font-semibold">문의·권리 행사 처리 기록</dt><dd className="mt-1 text-stone-600">처리 완료 후 30일 이내 삭제합니다. 분쟁이 진행 중인 경우 해결 시까지 필요한 기록만 접근을 제한하여 보관하고, 해결 후 30일 이내 삭제합니다. 별도로 적용되는 법령상 보존 의무가 있으면 해당 근거·항목·기간을 안내합니다.</dd></div>
            <div className="py-4"><dt className="font-semibold">호스팅·인증 로그</dt><dd className="mt-1 text-stone-600">현재 Supabase Free의 API·DB 로그 보관 안내는 1일, Vercel Hobby의 런타임 로그 조회 기간은 1시간입니다. 이를 모든 보안 기록·인증 기록·백업 사본의 삭제 기한으로 보장하지 않습니다. 그 밖의 기록·사본의 보관·삭제 조건은 확인 중입니다.</dd></div>
            <div className="py-4"><dt className="font-semibold">백업·복구 사본</dt><dd className="mt-1 text-stone-600">운영자가 별도의 개인정보 백업을 추가로 만들지 않는 것을 운영 기준으로 합니다. 현재 Supabase Free는 유료 플랜의 일일 백업 기능을 포함하지 않습니다. 제공사 내부 복구 사본까지 없다는 뜻은 아니며, 잔존 사본의 범위와 삭제 반영 시점은 확인 중입니다.</dd></div>
          </dl>
        </section>

        <section id="deletion" aria-labelledby="deletion-title">
          <h2 id="deletion-title">파기 절차와 방법</h2>
          <p>최근 본인 인증과 최종 삭제 확인 후 계정과 연결된 프로필·관심 분야·수준·답안·점수·읽기·저장·콘·이용량 기록을 운영 데이터베이스에서 삭제합니다. 공용 기사·퀴즈 자체는 개인의 학습 기록과 구분합니다.</p>
          <p>일일 이용량과 추가 열람 기록은 매일 정리하고, 실패한 기록은 다음 실행에서 다시 처리합니다. 문의 기록은 개인정보 보호책임자가 기간을 확인하여 첨부파일·보낸 답장·휴지통 사본을 포함해 삭제하는 것을 운영 절차로 정합니다.</p>
          <p>법령상 보존이 필요한 정보는 다른 이용 목적에서 분리하고 접근을 제한합니다. 복구 사본을 사용하는 경우 삭제한 계정·기록이 다시 노출되지 않는지 확인한 뒤 운영에 반영합니다. 제공사 내부 사본까지 탈퇴 순간에 모두 삭제된다고 안내하지 않습니다.</p>
        </section>

        <section id="providers" aria-labelledby="providers-title">
          <h2 id="providers-title">외부 서비스와 처리위탁</h2>
          <dl className="mt-3 space-y-4">
            <div><dt className="font-semibold">Supabase Pte. Ltd. — 인증·데이터 저장</dt><dd className="text-stone-600">계정·Google 프로필·학습·이용량 데이터의 인증·저장·조회·삭제에 사용합니다. 프로젝트 데이터베이스는 대한민국 서울 리전에 있습니다. 로그인·삭제 인증번호는 현재 Supabase 기본 이메일 발송 서비스를 통해 전달하며, 실제 하위 발송업체·처리 국가·보관 조건은 별도 확인 대상입니다.</dd></div>
            <div><dt className="font-semibold">Vercel Inc. — 웹·API 호스팅</dt><dd className="text-stone-600">웹 화면 제공과 API 요청 처리를 위해 요청의 인증 토큰·학습 데이터·접속 관련 정보를 처리합니다. 서버 함수 실행 리전은 서울로 설정되어 있습니다. 전송망·보안·로그 등 모든 처리가 국내에 한정된다는 의미는 아닙니다.</dd></div>
            <div><dt className="font-semibold">Google의 Gmail — 문의 이메일</dt><dd className="text-stone-600">문의자의 이메일·본문·첨부파일·답신 내역을 Google 메일 서비스에서 처리합니다. 운영자의 보관 기준은 처리 완료 후 30일 이내 삭제입니다. 계약상 역할, 실제 국외 처리 범위와 Google 내부 사본의 삭제 조건은 최종 확인 대상입니다.</dd></div>
          </dl>
          <p>Google 로그인은 이용자가 선택하는 별도의 인증 연동입니다. Google이 직접 처리하는 정보에는 <a href="https://policies.google.com/privacy?hl=ko" className="underline">Google 개인정보처리방침</a>도 적용됩니다. 제공사를 변경하면 실제 업무·항목·국가·기간과 계약 조건을 확인하여 이 방침에 반영합니다.</p>
        </section>

        <section id="transfers" aria-labelledby="transfers-title">
          <h2 id="transfers-title">제3자 제공과 국외 이전</h2>
          <p>현재 앱 코드에는 회원 이메일·학습 기록을 광고사업자에게 보내거나 다른 회원에게 공개하는 기능이 없습니다. 서비스 제공을 위한 외부 처리는 앞의 항목과 같이 구분하여 안내합니다.</p>
          <p>서울 데이터베이스와 서울 서버 설정만으로 국외 이전이 없다고 판단하지 않습니다. 외부 서비스의 메일 발송·지원·보안·로그 처리에서 국외 처리 또는 조회가 발생할 수 있습니다.</p>
          <p>최종 공개본에는 실제 경로별 이전 항목, 국가, 시기·방법, 이전받는 자의 명칭·연락처, 목적·보유기간, 이전 근거와 거부 방법·영향을 확정하여 기재합니다. 현재 이 범위가 모두 확인되지 않아 이 문서를 확정본으로 시행하지 않습니다.</p>
        </section>

        <section id="device" aria-labelledby="device-title">
          <h2 id="device-title">기기에 저장하는 정보</h2>
          <p>로그인 유지를 위한 인증 세션을 브라우저의 로컬 저장소 또는 Android 앱 저장 공간에 보관합니다. 계정 삭제 인증 후 돌아갈 화면을 위한 임시 정보와 배경음악 켜기·끄기 설정도 기기에 저장합니다. 음악 설정은 서버의 회원 기록으로 업로드하지 않습니다.</p>
          <p>로그아웃하면 현재 기기의 로그인 상태가 해제됩니다. 브라우저의 사이트 데이터 삭제나 Android의 앱 데이터 삭제로 저장 정보를 지울 수 있습니다. 저장을 차단하거나 삭제하면 로그인 유지와 음악 설정 복원이 제한될 수 있고, 서버의 계정·학습 기록은 함께 삭제되지 않습니다.</p>
          <p>현재 앱에는 AdMob, 광고 식별자 수집, 푸시 알림 SDK나 별도 이용자 분석 SDK가 연결되어 있지 않습니다. 호스팅·인증 로그와는 별개입니다. 광고·분석·알림을 도입하면 실제 처리 내용과 필요한 동의 절차를 먼저 반영합니다.</p>
        </section>

        <section id="ai" aria-labelledby="ai-title">
          <h2 id="ai-title">AI 콘텐츠와 읽기 수준 조정</h2>
          <p>기사·기초 콘텐츠, 용어 설명과 퀴즈 제작에 부산대학교 PNU Cloud Pickle을 사용합니다. 현재 생성 경로에는 회원 이메일·계정 ID·개별 답안·학습 기록을 입력하지 않습니다. 다만 공개 참고자료나 원문의 저자명·인물 정보가 포함될 수 있습니다. 제공사의 입력·출력 보관·학습 이용·삭제 조건은 추가 확인 대상이며, 별도 근거 없이 ‘AI 학습에 사용되지 않는다’고 보장하지 않습니다.</p>
          <p>읽기 수준은 서비스 규칙으로 조정합니다. 분야별 최근 퀴즈 최대 3회의 평균 정답률이 75% 이상이면 한 단계 올리고, 40% 이하이면 한 단계 내리며, 1~3단계 범위에서 적용합니다. Original 기초와 반복 풀이는 분야 수준을 바꾸지 않습니다.</p>
          <p>이 조정은 다음 글의 난이도를 맞추기 위한 기능입니다. 사용 정보·결과의 설명, 정정이나 이의 제기는 개인정보 문의 이메일로 요청할 수 있습니다.</p>
        </section>

        <section id="rights" aria-labelledby="rights-title">
          <h2 id="rights-title">내 정보 확인과 삭제</h2>
          <p>정보의 열람·정정·삭제·처리정지와 동의 철회는 개인정보 문의 이메일로 요청할 수 있습니다. 법정대리인이나 위임받은 대리인을 통한 요청도 가능하며, 필요한 최소 범위에서 본인 또는 대리인임을 확인하고 관련 법령의 절차와 기한에 따라 처리합니다.</p>
          <p>앱에서는 ‘나 → 계정 및 데이터 삭제’에서 진행합니다. 앱 없이도 아래 페이지에서 가입한 이메일로 인증번호를 받아 본인 확인 후 삭제할 수 있습니다. 인증번호 확인만으로 삭제되지 않으며 마지막 삭제 확인이 필요합니다.</p>
          <p>탈퇴하면 계정과 프로필, 관심 분야·수준, 퀴즈·읽기·저장·콘·이용량 기록을 함께 삭제하며 복구할 수 없습니다. 로그아웃과 앱 삭제는 회원 탈퇴가 아닙니다. 요청을 제한하거나 거절하면 이유와 이의 제기 방법을 안내하며, 처리 결과에 대한 이의도 같은 이메일로 접수합니다.</p>
          <Link href="/account/delete/" className="ac-intro-link mt-2 font-semibold">계정 및 데이터 삭제 안내</Link>
          <p>외부 상담·피해구제가 필요한 경우 <a href="https://privacy.kisa.or.kr/" className="underline">개인정보침해신고센터</a> 또는 <a href="https://www.kopico.go.kr/" className="underline">개인정보분쟁조정위원회</a>를 이용할 수 있습니다.</p>
        </section>

        <section id="age" aria-labelledby="age-title">
          <h2 id="age-title">가입 연령</h2>
          <p>회원 가입은 만 14세 이상부터 가능합니다. 로그인 화면에서 직접 확인하며 생년월일이나 신분증 사본은 수집하지 않습니다. 만 14세 미만의 가입 사실을 알게 되면 필요한 최소 범위에서 확인하고 해당 계정과 개인정보를 삭제합니다.</p>
        </section>

        <section id="security" aria-labelledby="security-title">
          <h2 id="security-title">개인정보 보호 조치</h2>
          <p>계정 인증, 사용자별 데이터 접근 제한, 서버 전용 비밀키 분리와 HTTPS 통신을 적용합니다. 계정 삭제에는 최근 본인 인증과 최종 확인을 요구합니다. Android 로그인·WebView 데이터는 앱의 클라우드 백업과 기기 이전에서 제외하도록 설정합니다.</p>
          <p>운영자는 업무에 필요한 최소한의 접근권한을 관리하고 문의·운영 자료의 보관기간과 삭제를 확인합니다. 장애 조사 때에도 불필요한 회원 데이터 사본을 만들지 않는 것을 운영 기준으로 합니다.</p>
        </section>

        <section id="changes" aria-labelledby="changes-title">
          <h2 id="changes-title">시행일과 변경 안내</h2>
          <p>이 문서는 최종 확인 중으로 아직 시행되지 않았습니다. 시행일은 외부 처리에 관한 확인을 마친 확정본의 실제 게시일로 정하고, 이 페이지에 구체적인 날짜를 표시합니다.</p>
          <p>처리 목적·항목·제공사·국외 이전·보관기간이 바뀌면 이 페이지에 변경 내용과 시행일을 안내합니다. 별도 동의나 개별 통지가 필요한 변경은 필요한 절차를 거칩니다. 시행된 방침을 변경할 때에는 이전 본문과 시행일을 함께 열람할 수 있도록 보관합니다.</p>
        </section>
      </div>
      <footer className="mt-10 border-t border-stone-200 pt-4">
        <Link href="/onboarding/?step=login" className="ac-intro-link">로그인 화면으로</Link>
      </footer>
    </main>
  );
}
