import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAccountForm } from "@/components/DeleteAccountForm";

export const metadata: Metadata = {
  title: "계정 및 데이터 삭제 | artice cream",
  description: "앱을 설치하지 않고 artice cream 계정과 학습 기록 삭제를 요청할 수 있습니다.",
};

/** Public, statically rendered information; authentication is only for the action. */
export default function DeleteAccountPage() {
  return (
    <main>
      <Link href="/account" className="text-sm text-stone-600 underline underline-offset-4">계정 화면으로</Link>
      <p className="mt-8 text-sm font-medium text-stone-500">artice cream</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">계정 및 데이터 삭제</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-700">
        앱을 설치하지 않아도 이 페이지에서 탈퇴할 수 있어요.
        삭제할 계정을 확인한 뒤 직접 삭제를 완료할 수 있어요.
      </p>

      <section aria-labelledby="deletion-scope" className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 id="deletion-scope" className="font-semibold text-stone-900">함께 삭제되는 정보</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>artice cream 로그인 계정과 프로필</li>
          <li>관심 분야·읽기 수준, 퀴즈 답안과 점수</li>
          <li>읽기·저장 기록과 내 콘에 쌓은 스쿱</li>
          <li>일일 이용량과 추가 열람 기록</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-red-800">
          삭제 완료 후 복구할 수 없어요. 다시 가입해도 이전 기록은 돌아오지 않아요.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          최종 확인 후 서비스의 계정·학습 데이터 삭제를 바로 처리하고 결과를 안내해요.
          연결한 Google 계정 자체는 삭제되지 않아요.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          이 기능은 서비스 운영 데이터의 삭제를 처리해요. 호스팅·인증 제공사의 보안 로그와
          백업 사본은 별도 관리 대상이며, 보관기간과 삭제 반영 절차는 확인 중이에요.
        </p>
      </section>

      <DeleteAccountForm />
    </main>
  );
}
