import type { Source } from "./feeds";

/** Public-license candidates only. These records never grant DB collection/processing/publication rights. */
export type SourceCandidate = {
  source: Source;
  name: string;
  license: "CC-BY-4.0" | "CC-BY-SA-4.0" | "CC-BY-SA-3.0-or-later" | "MIT";
  licenseUrl: string;
  evidenceUrl: string;
  sampleUrl: string;
  /** Reviewed source file; repository license alone is insufficient evidence of article scope. */
  repositorySampleUrl?: string;
  scope: "page-notice" | "repository-match" | "post-exceptions";
  requiredNotices: string[];
  limits: string[];
};

const credit = ["원저자·기여자", "원제·원문 영구 링크", "라이선스명·링크", "한국어 번역·요약·난이도별 재작성·용어/퀴즈 추가 표시", "기존 저작권·면책·변경 고지 보존"];
const textOnly = ["본문 텍스트만 검토", "이미지·영상·코드·댓글·외부 재게시 자료는 별도 허락 없이 사용하지 않음", "원저자의 보증·후원으로 표시하지 않음", "글별 예외와 실제 외부 처리 조건 확인 후 개별 승인"];
const shareAlike = "공개하는 번역·재작성 및 해당 파생 학습 자료에 CC BY-SA 4.0 적용 표시; 수신자의 라이선스 이용을 제한하는 추가 조건 금지";

export const SOURCE_CANDIDATES: SourceCandidate[] = [
  { source: { id: "kubernetes", url: "https://kubernetes.io/feed.xml", lang: "en", kind: "blog" }, name: "Kubernetes",
    license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    evidenceUrl: "https://github.com/kubernetes/website/blob/main/LICENSE",
    sampleUrl: "https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/", scope: "repository-match",
    repositorySampleUrl: "https://raw.githubusercontent.com/kubernetes/website/main/content/en/blog/_posts/2026/kubernetes-cgroups-v2-shift.md",
    requiredNotices: credit, limits: [...textOnly, "kubernetes/website 저장소의 해당 영문 블로그 파일과 게시 원문 대응 확인"] },
  { source: { id: "owasp-genai", url: "https://genai.owasp.org/feed/", lang: "en", kind: "blog" }, name: "OWASP GenAI",
    license: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    evidenceUrl: "https://genai.owasp.org/contributing/", sampleUrl: "https://genai.owasp.org/", scope: "page-notice",
    requiredNotices: [...credit, shareAlike], limits: [...textOnly, "실제 글의 사이트 기본 라이선스 표시와 별도 제외 고지 확인; 프로젝트 코드 라이선스를 글로 확대하지 않음"] },
  { source: { id: "duckdb", url: "https://duckdb.org/feed.xml", lang: "en", kind: "blog" }, name: "DuckDB",
    license: "MIT", licenseUrl: "https://github.com/duckdb/duckdb-web/blob/main/LICENSE",
    evidenceUrl: "https://github.com/duckdb/duckdb-web/blob/main/LICENSE",
    sampleUrl: "https://duckdb.org/2026/10/07/view-only-mode", scope: "repository-match",
    repositorySampleUrl: "https://raw.githubusercontent.com/duckdb/duckdb-web/main/_posts/2026-10-07-view-only-mode.md",
    requiredNotices: [...credit, "Stichting DuckDB Foundation 저작권과 MIT 허락문·면책문 전문 보존; 링크만으로 대체하지 않음"],
    limits: [...textOnly, "duckdb/duckdb 소프트웨어가 아닌 duckdb/duckdb-web의 _posts 파일과 게시 원문 대응 확인"] },
  { source: { id: "mozilla-hacks", url: "https://hacks.mozilla.org/feed/", lang: "en", kind: "blog", archive: { url: "https://hacks.mozilla.org/feed/" } }, name: "Mozilla Hacks",
    license: "CC-BY-SA-3.0-or-later", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    evidenceUrl: "https://hacks.mozilla.org/", sampleUrl: "https://hacks.mozilla.org/2026/08/intent-to-ship-jpeg-xl/", scope: "page-notice",
    requiredNotices: [...credit, shareAlike, "원문 3.0 이상 허용 표시 보존; 제공자가 허용한 later-version 선택에 근거해 가공본은 CC BY-SA 4.0으로 표시"], limits: textOnly },
  { source: { id: "web-dev", url: "https://web.dev/feed.xml", lang: "en", kind: "blog", archive: { url: "https://web.dev/feed.xml" } }, name: "web.dev",
    license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    evidenceUrl: "https://developers.google.com/terms/site-policies", sampleUrl: "https://web.dev/blog/interop-2026", scope: "page-notice",
    requiredNotices: [...credit, "Google이 제공한 원문에 기초해 수정했음을 표시하고 원문·Google 사이트 정책 링크 제공"],
    limits: [...textOnly, "해당 글 footer에 CC BY 4.0 표시가 있는 경우만 후보; 코드 샘플의 Apache 2.0과 상표·미디어 예외 분리"] },
  { source: { id: "chrome-developers", url: "https://developer.chrome.com/static/blog/feed.xml", lang: "en", kind: "blog", archive: { url: "https://developer.chrome.com/static/blog/feed.xml" } }, name: "Chrome for Developers",
    license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    evidenceUrl: "https://developers.google.com/terms/site-policies", sampleUrl: "https://developer.chrome.com/blog/new-in-chrome-141", scope: "page-notice",
    requiredNotices: [...credit, "Google이 제공한 원문에 기초해 수정했음을 표시하고 원문·Google 사이트 정책 링크 제공"],
    limits: [...textOnly, "해당 글 footer의 CC BY 4.0 표시 확인; Google Cloud/Research/다른 블로그에 확대 적용하지 않음"] },
  { source: { id: "rust-blog", url: "https://blog.rust-lang.org/feed.xml", lang: "en", kind: "blog" }, name: "Rust Blog",
    license: "MIT", licenseUrl: "https://github.com/rust-lang/blog.rust-lang.org/blob/main/LICENSE-MIT",
    evidenceUrl: "https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md",
    sampleUrl: "https://blog.rust-lang.org/2026/10/02/demoting-i686-windows-targets-to-std-only/", scope: "repository-match",
    repositorySampleUrl: "https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/content/demoting-i686-windows-targets-to-std-only.md",
    requiredNotices: [...credit, "원문의 저작권 고지와 선택한 MIT 허락문·면책문 전문 보존"],
    limits: [...textOnly, "README가 블로그 자체의 MIT/Apache 2.0을 명시; MIT 선택, 저장소의 실제 글 대응과 별도 예외 확인"] },
  { source: { id: "go-blog", url: "https://go.dev/blog/feed.atom", lang: "en", kind: "blog" }, name: "Go Blog",
    license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    evidenceUrl: "https://go.dev/copyright", sampleUrl: "https://go.dev/blog/archsimd", scope: "page-notice",
    requiredNotices: [...credit, "Go Authors/Google 제공 원문을 수정한 사실과 저자·원문·Google 사이트 정책 표시"],
    limits: [...textOnly, "본문은 go.dev/copyright의 CC BY 4.0 적용, 코드는 BSD; 코드·로고·외부 자료는 별도 검토"] },
  { source: { id: "fedora-magazine", url: "https://fedoramagazine.org/feed/", lang: "en", kind: "blog" }, name: "Fedora Magazine",
    license: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    evidenceUrl: "https://fedoramagazine.org/terms-and-conditions/",
    sampleUrl: "https://fedoramagazine.org/podman-test-week-help-test-the-rust-based-conmon-v3/", scope: "post-exceptions",
    requiredNotices: [...credit, '"By [author’s screen name] from Fedora Magazine" 표시와 원문 영구 링크', shareAlike],
    limits: [...textOnly, "약관의 Red Hat 원저작물/기여자 허락 범위와 글·저자별 라이선스 예외 확인; 모든 글을 일괄 승인하지 않음"] },
  { source: { id: "wikimedia-tech", url: "https://diff.wikimedia.org/category/technology/feed/", lang: "en", kind: "blog" }, name: "Wikimedia Diff Technology",
    license: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    evidenceUrl: "https://diff.wikimedia.org/editorial-guidelines/", sampleUrl: "https://diff.wikimedia.org/category/technology/", scope: "page-notice",
    requiredNotices: [...credit, shareAlike], limits: [...textOnly, "Technology 분류 피드만 등록; 다른 언어·비기술 글은 분류/개별 검토에서 제외", "외부 링크·Commons 미디어는 각각 다른 권리일 수 있음"] },
];
