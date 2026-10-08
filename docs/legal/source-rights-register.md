# 소스별 권리 확인 목록

기준: 2026-10-08, [SOURCES](../../lib/news/feeds.ts)의 등록 47개(기존 40 + 신규 7). 주석 처리된 `woowahan`은 제외했다.
16개 소스의 공개 조건을 1차 검토했고 31개는 미확인이다. 정확한 본문 라이선스 근거가 있는 조건부 후보 10개는 [추가 후보 검토](source-candidates.md)에 적용 범위·표시 조건·실제 피드 공급량을 기록했다. 현재 Kubernetes·Go의 수집 승인 2개, 가공·공개 소스 승인 0개, 개별 글의 본문 권리 승인 2편이다. [수집 재개 기록](licensed-collection.md).
운영 DB에 권리 게이트를 적용했다. 기존 글은 기본 `unreviewed`이며, 10-08 개별 검토한 Lemire ready 6편은 출처를 보완한 뒤 `restricted`로 기록했다. 0003 후보 등록 후 검토한 16개 소스는 `restricted`, 나머지는 `unreviewed`다. DB에는 과거 `woowahan`까지 총 48개가 있다.
0004로 Kubernetes·Go만 `permitted`·`allow_collect=true`로 변경했다. DB는 `permitted` 2·`restricted` 14·`unreviewed` 32개이며 가공·공개 플래그는 모든 소스에서 false다. CC 허용 조건을 찾았다는 사실과 개별 글·제공사 처리까지의 운영 승인은 구별한다.

## 소스 축소 전 판정 기준 정정

2026-10-08, 명시적 이용허락이 없는 소스를 제외하라는 요청을 처음에는 Kubernetes 1개만 남기는 방식으로 준비했다. 이어 사용자가 소스 수가 지나치게 적어지는 이유와 실제 크롤링 금지 여부를 물어, 해당 일괄 제거 변경을 원복했다. 등록 40개를 유지했고 39개 일괄 차단 마이그레이션은 운영 DB에 적용하지 않았다. 적용하지 않은 초안도 제거했다.

**미확인은 크롤링 금지 판정이 아니다.** 기존 32개 미확인 소스는 당시 약관 검토가 끝나지 않았다는 뜻이다. RSS 제공, 자동 원문 접근, AI 가공, 가공본의 상업적 공개 범위를 따로 확인한다. RSS가 존재하거나 `robots.txt`가 경로를 허용한다는 사실만으로 기사 전문 재작성·배포를 승인하지 않는다. 반대로 재배포 근거 미확인을 근거로 원문 접근이 모두 금지되어 있다고 표현하지 않는다.

추가로 확인한 근거:

- **OWASP GenAI**: [기여 안내 페이지](https://genai.owasp.org/contributing/) footer는 별도 표시가 없는 사이트 콘텐츠의 기본 라이선스를 **CC BY-SA 4.0**으로 명시한다. 안내 문서뿐 아니라 실제 글 footer·예외도 확인한다. 번역·재작성 공개 때 동일조건변경허락과 기여자·면책·변경 표시를 구현해야 한다.
- **DuckDB**: 소프트웨어 본체와 별개인 [웹사이트 저장소](https://github.com/duckdb/duckdb-web)에 블로그 `_posts`가 포함되고, [그 저장소의 LICENSE](https://github.com/duckdb/duckdb-web/blob/main/LICENSE)는 MIT다. 해당 원문이 이 저장소 파일과 대응하는지, 제3자 예외가 있는지 확인하면 재사용 후보로 검토할 수 있다. 사이트의 모든 외부 링크나 다른 저장소 콘텐츠까지 확대 적용하지 않는다.
- **PyTorch**: [기존 웹사이트 저장소의 BSD 3-Clause LICENSE](https://github.com/pytorch/pytorch.github.io/blob/site/LICENSE)가 존재한다. 이것을 현재 WordPress 블로그의 모든 신규 글에 자동 적용하지 않고 실제 파일 대응과 범위를 확인한다.
- **Eli Bendersky**: [About](https://eli.thegreenplace.net/pages/about)는 별도 표시가 없는 블로그 **코드**의 public domain을 명시한다. 이 조건을 글 본문 전체의 재배포 허락으로 확대하지 않는다.
- **Simon Willison**: [About](https://simonwillison.net/about/)는 RSS/Atom 구독 주소를 안내한다. 장문 가공본의 외부 배포 라이선스는 여기서 확인되지 않았다. 크롤링 전면 금지라고 판단한 것은 아니다.

따라서 "사용 가능한 소스가 1개뿐"이라는 결론은 확정하지 않는다. 먼저 실제 이용 조건을 검토해 **조건부 재사용 가능 / 현재 사용에 제한 / 미확인**을 구별한 뒤 수집 목록을 조정한다. 이 추가 근거 확인으로 운영 승인 플래그를 자동 변경하지는 않았다.

| Source ID | 피드 | 확인 상태 | 근거·다음 조치 |
|---|---|---|---|
| aws-news | [RSS](https://aws.amazon.com/blogs/aws/feed/) | 보류 | [사이트 약관](https://aws.amazon.com/terms/): 자동 추출·파생·상업 이용 제한, 별도 허락 확인 |
| gcp-blog | [RSS](https://cloudblog.withgoogle.com/rss/) | 미확인 | Google 개발자 문서의 라이선스를 블로그에 확대 적용하지 말고 해당 글 조건 확인 |
| cloudflare | [RSS](https://blog.cloudflare.com/rss/) | 보류 | [사이트 약관](https://www.cloudflare.com/website-terms/): 명시적 허용 범위 및 블로그 추가 조건 확인 |
| kubernetes | [RSS](https://kubernetes.io/feed.xml) | 조건부 후보 | [website LICENSE](https://raw.githubusercontent.com/kubernetes/website/main/LICENSE): CC BY 4.0, 개별 글 적용 범위·크레딧·변경 표시 확인 |
| cncf | [RSS](https://www.cncf.io/feed/) | 조건부 후보 | [공식 블로그 기고 지침](https://github.com/cncf/foundation/blob/main/policies-guidance/blog-guidelines.md)이 CC Attribution을 명시. 정확한 버전·개별 글·게스트/재게시·이미지 예외 확인 |
| thenewstack | [RSS](https://thenewstack.io/feed/) | 미확인 | 재게시·요약·AI 처리 허용 범위 확인 |
| infoq | [RSS](https://feed.infoq.com/) | 요약+링크 후보 | [약관](https://www.infoq.com/terms-and-conditions/): 현재 장문 재작성까지 허용되는지 별도 확인 |
| meta-eng | [RSS](https://engineering.fb.com/feed/) | 미확인 | 사이트 글과 소프트웨어 라이선스 구분 |
| toss | [RSS](https://toss.tech/rss.xml) | 미확인 | 번역·재가공·상업 서비스 이용 조건 확인 |
| lycorp-ko | [RSS](https://techblog.lycorp.co.jp/ko/feed/index.xml) | 미확인 | 한국어 글 및 원문·사진의 권리 확인 |
| google-research | [RSS](https://research.google/blog/rss/) | 미확인 | 글·논문·도표 각각의 라이선스 확인 |
| deepmind | [RSS](https://deepmind.google/blog/rss.xml) | 미확인 | 사이트 약관과 글별 별도 허락 확인 |
| huggingface | [RSS](https://huggingface.co/blog/feed.xml) | 미확인 | 회사 글·커뮤니티 글·모델 라이선스 구분 |
| pytorch | [RSS](https://pytorch.org/feed/) | 미확인 | 블로그·문서·소프트웨어 라이선스 구분 |
| nvidia-dev | [RSS](https://developer.nvidia.com/blog/feed/) | 미확인 | 개발자 블로그의 재게시·AI 입력 조건 확인 |
| mit-news-ai | [RSS](https://news.mit.edu/rss/topic/artificial-intelligence2) | 미확인 | 뉴스 재사용 조건, 상업·수정 제한, 이미지 예외 확인 |
| msr | [RSS](https://www.microsoft.com/en-us/research/feed/) | 미확인 | 연구 블로그·논문·이미지별 조건 확인 |
| simonwillison | [RSS](https://simonwillison.net/atom/entries/) | 미확인 | 개인 저자 이용허락·인용자료 예외 확인 |
| interconnects | [RSS](https://www.interconnects.ai/feed) | 미확인 | 저자·플랫폼 약관, 유료/무료 글 구분 |
| aitimes | [RSS](https://www.aitimes.com/rss/allArticle.xml) | 미확인 | 언론사 기사 재가공·재배포 허락 확인 |
| embracethered | [RSS](https://embracethered.com/blog/index.xml) | 미확인 | 저자 이용허락 및 화면 캡처 권리 확인 |
| owasp-genai | [RSS](https://genai.owasp.org/feed/) | 조건부 후보 | [기여 안내](https://genai.owasp.org/contributing/) footer가 별도 표시 없는 사이트 콘텐츠에 CC BY-SA 4.0을 명시. 실제 글 footer·예외·기여자와 동일조건변경허락·면책·변경 표시 확인 |
| trailofbits | [RSS](https://blog.trailofbits.com/feed/) | 미확인 | 블로그 본문 및 제3자 자료 조건 확인 |
| google-security | [RSS](https://security.googleblog.com/feeds/posts/default) | 미확인 | Google의 다른 사이트 라이선스와 구분해 확인 |
| thehackernews | [RSS](https://feeds.feedburner.com/TheHackersNews) | 미확인 | 발행처 약관 및 기사·이미지 재배포 허락 확인 |
| bleepingcomputer | [RSS](https://www.bleepingcomputer.com/feed/) | 미확인 | 자동 수집·재가공·상업 배포 조건 확인 |
| securityweek | [RSS](https://www.securityweek.com/feed/) | 미확인 | 외부 통신사 기사 포함 여부와 재배포 권리 확인 |
| dailysecu | [RSS](https://www.dailysecu.com/rss/allArticle.xml) | 미확인 | 언론사 및 기고자 재가공 허락 확인 |
| unit42 | [RSS](https://unit42.paloaltonetworks.com/feed/) | 미확인 | 회사 약관·연구 자료 별도 조건 확인 |
| oldnewthing | [RSS](https://devblogs.microsoft.com/oldnewthing/feed) | 미확인 | 과거 글 아카이브 포함, 글별 조건·저자 권리 확인 |
| lemire | [RSS](https://lemire.me/blog/feed/) | 재공개 보류 | [이용 조건](https://lemire.me/blog/terms-of-use/)은 댓글 외 본문에 CC BY 3.0을 연결. 기존 공개본의 필수 표시 누락을 발견했고 3.0은 자동 복구가 없어 명시적 재공개 근거를 확인해야 한다. [6편 검토·수정 기록](lemire-review.md), Antonio Badia 게스트 글 권리 범위와 제공사 조건도 확인 |
| murat | [RSS](https://muratbuffalo.blogspot.com/feeds/posts/default) | 미확인 | 과거 글 포함, 저자 허락·외부 인용자료 확인 |
| eli-bendersky | [RSS](https://eli.thegreenplace.net/feeds/all.atom.xml) | 미확인 | 글과 코드의 이용허락 구분 |
| brooker | [RSS](https://brooker.co.za/blog/rss.xml) | 미확인 | 전체 피드의 과거 글 포함, 저자 조건 확인 |
| julia-evans | [RSS](https://jvns.ca/atom.xml) | 미확인 | 사이트맵의 과거 글 포함, 글·만화·유료 자료 구분 |
| databricks | [RSS](https://www.databricks.com/feed) | 보류 | [약관](https://www.databricks.com/legal/terms-of-use): 번역·파생·배포 등 제한, 별도 허락 확인 |
| towardsdatascience | [RSS](https://towardsdatascience.com/feed/) | 미확인 | 플랫폼·각 기고자의 권리 및 유료 자료 구분 |
| duckdb | [RSS](https://duckdb.org/feed.xml) | 저장소 대응 확인 후보 | [website LICENSE](https://github.com/duckdb/duckdb-web/blob/main/LICENSE)는 MIT, 해당 저장소의 블로그 파일과 원문 대응·제3자 예외·고지 보존 확인 |
| spotify-eng | [RSS](https://engineering.atspotify.com/feed/) | 미확인 | 기술 블로그 재가공·배포 조건 확인 |
| devsisters | [RSS](https://tech.devsisters.com/rss.xml) | 미확인 | 저자·회사 허락과 이미지 예외 확인 |
| mozilla-hacks | [RSS](https://hacks.mozilla.org/feed/) | 조건부 후보 | [실제 글 footer](https://hacks.mozilla.org/2026/08/intent-to-ship-jpeg-xl/): CC BY-SA 3.0 또는 이후 버전, 저자·변경·BY-SA 표시; 현재 피드는 과거 글 후보 |
| web-dev | [RSS](https://web.dev/feed.xml) | 조건부 후보 | [Google 정책](https://developers.google.com/terms/site-policies)과 실제 글 CC BY 4.0 고지 확인. Google·저자·변경 표시, 코드/미디어 제외 |
| chrome-developers | [RSS](https://developer.chrome.com/static/blog/feed.xml) | 조건부 후보 | [Google 정책](https://developers.google.com/terms/site-policies)과 실제 글 CC BY 4.0 고지 확인, 공식 RSS 주소 검사 통과 |
| rust-blog | [RSS](https://blog.rust-lang.org/feed.xml) | 조건부 후보 | [블로그 README](https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md)의 MIT/Apache 2.0 중 MIT 선택. 실제 글 파일 대응·전문 고지 보존 |
| go-blog | [Atom](https://go.dev/blog/feed.atom) | 조건부 후보 | [사이트 copyright](https://go.dev/copyright): 본문 CC BY 4.0, 코드는 별도 BSD. 저자·출처·변경·제공 고지 보존 |
| fedora-magazine | [RSS](https://fedoramagazine.org/feed/) | 글별 확인 후보 | [약관 6·7항](https://fedoramagazine.org/terms-and-conditions/): CC BY-SA 4.0 범위·예외·공동 저자 확인, 지정 출처 문구·영구 링크·BY-SA 표시 |
| wikimedia-tech | [RSS](https://diff.wikimedia.org/category/technology/feed/) | 조건부 후보 | [편집 지침](https://diff.wikimedia.org/editorial-guidelines/): Diff 본문 CC BY-SA 4.0, 실제 글·언어·주제·매체 예외 확인 |

## 개별 글 승인 기록 양식

실제 필드·승인/차단 절차는 [콘텐츠 권리 게이트](content-rights-gate.md)를 따른다. 소스 전체 허용만으로 기존 글이 공개되지는 않는다.

- source ID / 원문 URL / 원제 / 저자 / 게시일:
- 권리자 / 연락처 또는 공개 이용 조건 URL:
- 허락 근거·버전 / 확인일 / 확인자 / 비공개 증빙 위치:
- 자동 수집·과거 글 / 원문 보관기간 / 외부 AI 처리·하위 처리 허용:
- 번역·수준별 재작성 / 용어·퀴즈 / 웹·앱 배포 / 광고·유료 이용:
- 지역·기간·편수 / 이미지·코드·제3자 자료 예외:
- 필수 표시(저자·출처·라이선스·변경·기존 권리 고지):
- 실제 가공본 표본 검토 / 종료·삭제 조건 / 재확인 예정일:
- 최종 상태와 근거: 미확인 / 허용 / 제한 / 차단

링크와 확인 날짜만으로 계약 증빙이 충분한 것은 아니다. 승인된 범위와 당시 조건을 보관하되, 계약·메일 원문과 개인 연락처는 공개 저장소에 넣지 않는다.
