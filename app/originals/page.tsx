import Link from "next/link";
export default function OriginalsInfo() {
  return <main className="mx-auto max-w-lg px-5 py-12 text-stone-800">
    <Link href="/" className="text-sm text-stone-500">← 홈</Link>
    <h1 className="mt-6 text-2xl font-bold">artice cream Original</h1>
    <div className="mt-6 space-y-4 leading-relaxed">
      <p>컴퓨터와 기술의 기초를 짧은 글과 예제로 배워요. 분야별 학습 목표에 맞춰 구성한 콘텐츠로, 외부 기사의 번역본과 구분해 표시해요.</p>
      <p>AI의 도움으로 집필하고 공식 참고자료와 문항 근거를 점검해요. 참고자료와 확인일은 각 글에서 볼 수 있어요. 오류를 발견하면 문의해 주세요.</p>
      <p>기초는 모든 읽기 수준에서 같은 본문을 제공해요. 처음 열 때는 기존 열람 횟수 규칙을 적용하고, 이미 연 글을 다시 읽거나 문제를 푸는 데는 추가 횟수를 쓰지 않아요.</p>
      <p>기초 퀴즈는 수준을 바꾸지 않아요. 첫 결과를 콘에 올린 뒤에도 계속 복습할 수 있고, 반복 풀이로 기존 점수·스쿱을 중복 변경하지 않아요.</p>
      <p>제작: artice cream · 운영자 무지개쥬스</p>
      <a className="underline" href="mailto:mujigaejuice@gmail.com">콘텐츠 문의</a>
    </div>
  </main>;
}
