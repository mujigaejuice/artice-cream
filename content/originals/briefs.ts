/** Authored curriculum; references verify facts, not a translation/rewrite source. */
import type { CategorySlug } from '../../lib/ai/schemas';
export type OriginalBrief = { key: string; domain: CategorySlug; order: number; title: string; facts: string; url: string };
const pg = 'https://www.postgresql.org/docs/18/';
const k8 = 'https://kubernetes.io/docs/concepts/';
const ml = 'https://developers.google.com/machine-learning/';
const gc = 'https://docs.cloud.google.com/';
const ow = 'https://cheatsheetseries.owasp.org/cheatsheets/';
const ga = 'https://genai.owasp.org/llmrisk/';
const groups: Record<CategorySlug, [string, string, string][]> = {
  cloud: [
    ['서버리스에도 서버가 있을까?', '서버리스는 서버가 없다는 뜻이 아니라 서버 운영 부담을 제공사에 맡기는 모델이다. 개발자는 코드와 설정·권한을 책임진다. 요청 기반 확장과 0개 축소는 제품·설정에 따라 다르며 모든 서버리스가 무료인 것은 아니다.', gc+'run/docs/overview/what-is-cloud-run'],
    ['서버를 키울까, 대수를 늘릴까?', '스케일 업은 개별 인스턴스 자원을 늘리고 스케일 아웃은 인스턴스 수를 늘린다. 부하 분산과 공유 상태 관리가 필요하며 데이터베이스 병목이 자동 해결되지는 않는다.', gc+'compute/docs/autoscaler'],
    ['리전과 존으로 장애 범위 나누기', '리전은 지리적 영역, 존은 리전 안 배포 구역이다. 여러 존에 나누면 한 존 장애에 대비할 수 있지만 데이터 복제·트래픽 전환 설계가 필요하다. 다중 존은 다중 리전과 다르다.', gc+'compute/docs/regions-zones'],
    ['파일을 객체로 저장한다는 뜻', '객체 스토리지는 데이터와 메타데이터를 객체 이름으로 저장한다. 버킷은 객체의 컨테이너다. Google Cloud Storage 객체 데이터는 불변이며 교체는 새 세대를 만든다. 파일시스템의 부분 덧쓰기와 같지 않다.', gc+'storage/docs/objects'],
    ['자동 확장이 비용 상한은 아닌 이유', '자동 확장은 부하에 맞게 인스턴스를 조정한다. 최소·최대 인스턴스와 동시 요청 설정이 지연·비용에 영향을 준다. 최대 인스턴스 제한만으로 전체 청구액 상한을 보장하지 않는다. 확장 지연을 고려한다.', gc+'run/docs/about-instance-autoscaling'],
    ['관리형 서비스에도 우리가 할 일이 있다', '제공사가 인프라 일부를 관리해도 고객은 데이터·계정 권한·애플리케이션 설정을 관리한다. 서비스 유형에 따라 책임 경계가 달라진다. 관리형이라는 이름이 잘못된 공개 설정을 막아 주지는 않는다.', gc+'architecture/framework/security/shared-responsibility-shared-fate'],
    ['클라우드 비용을 사용량으로 읽기', '컴퓨팅 시간·저장 용량·네트워크 전송은 대표 과금 축이다. 단가는 제품·리전·요금제마다 다르므로 숫자 가격을 단정하지 않는다. 사용량과 청구 항목을 함께 확인한다. 예산 알림은 자동 지출 차단이 아니다.', gc+'billing/docs/how-to/budgets'],
    ['권한은 사용자와 역할의 조합이다', 'IAM 정책은 주체에 리소스의 역할을 부여한다. 역할은 권한 묶음이다. 상위 리소스 권한이 하위에 상속될 수 있으므로 최소 범위를 선택한다. 로그인 성공과 리소스 접근 허용은 별개다.', gc+'iam/docs/overview'],
  ],
  infra: [
    ['컨테이너는 무엇을 함께 묶을까?', '컨테이너 이미지는 실행 코드와 의존성을 묶는다. 이미지는 실행 중 컨테이너 자체와 다르다. 컨테이너는 보통 호스트 커널을 공유하므로 가상머신처럼 각자 운영체제 커널을 갖는 것은 아니다.', k8+'containers/'],
    ['파드와 노드, 실행 단위 구분하기', '노드는 워크로드를 실행하는 머신이다. 파드는 쿠버네티스에서 배포 가능한 최소 단위로 하나 이상의 컨테이너가 네트워크와 저장소를 공유한다. 모든 관련 서비스를 한 파드에 넣을 필요는 없다.', k8+'workloads/pods/'],
    ['선언한 상태와 실제 상태 맞추기', '컨트롤러는 원하는 상태와 현재 상태의 차이를 줄인다. Deployment는 복제 파드를 관리하고 업데이트한다. replicas 3은 항상 3개가 정상이라는 즉시 보장이 아니라 조정 목표다.', k8+'architecture/controller/'],
    ['이름은 그대로, 파드는 바뀌어도', '파드는 교체되며 IP가 바뀔 수 있다. Service는 선택된 파드 집합에 안정적인 접근점을 제공한다. 셀렉터와 라벨이 대상을 결정하며 잘못된 라벨은 연결 문제를 만든다.', k8+'services-networking/service/'],
    ['설정과 비밀값을 따로 관리하기', 'ConfigMap은 비밀이 아닌 설정, Secret은 민감한 값을 관리하는 용도다. base64는 암호화가 아니며 Secret이라는 이름만으로 저장 암호화와 권한 보호가 보장되지 않는다. 로그에 비밀값을 쓰지 않는다.', k8+'configuration/secret/'],
    ['준비됨과 살아 있음은 다르다', 'readiness 실패는 서비스 트래픽 대상에서 제외하는 데 사용하고 liveness 반복 실패는 컨테이너 재시작으로 이어질 수 있다. startup probe는 느린 시작을 보호한다. 외부 의존 장애를 잘못 liveness에 연결하면 재시작 폭주가 생길 수 있다.', k8+'configuration/liveness-readiness-startup-probes/'],
    ['CPU와 메모리의 요청량·상한', 'requests는 스케줄링에 사용할 자원 요청량이고 limits는 사용 제한이다. CPU 제한은 throttling, 메모리 제한 초과는 OOM 종료로 이어질 수 있다. 메모리 제한이 자동으로 메모리 누수를 고치지는 않는다.', k8+'configuration/manage-resources-containers/'],
    ['로그·메트릭·트레이스를 함께 보기', '로그는 개별 사건 기록, 메트릭은 시간에 따른 수치, 트레이스는 요청의 여러 작업 흐름을 보여 준다. 지연 증가를 메트릭으로 찾고 트레이스로 구간을 좁히고 로그로 사건을 살핀다. 민감한 값을 수집하지 않도록 한다.', 'https://opentelemetry.io/docs/concepts/signals/'],
  ],
  data: [
    ['테이블에서 필요한 행과 열 찾기', 'SELECT는 열을 고르고 WHERE는 조건에 맞는 행을 고른다. ORDER BY 없이는 결과 순서를 보장하지 않는다. 조회는 원본 행을 삭제하지 않는다. 자체 작은 메뉴 테이블 예제로 설명한다.', pg+'tutorial-select.html'],
    ['NULL은 0이나 빈 문자열이 아니다', 'NULL은 값이 없거나 알려지지 않았음을 나타낸다. = NULL 대신 IS NULL을 쓴다. NULL 비교는 참·거짓 외 unknown이 될 수 있고 WHERE는 참인 행만 남긴다. 0은 실제 수치다.', pg+'functions-comparison.html'],
    ['묶어서 계산하는 GROUP BY', 'GROUP BY는 같은 그룹 값의 행을 묶어 집계한다. WHERE는 집계 전 행, HAVING은 집계 뒤 그룹을 제한한다. COUNT(*)는 행 수, COUNT(column)은 해당 열이 NULL이 아닌 행 수다.', pg+'tutorial-agg.html'],
    ['JOIN하면 행 수가 늘어나는 이유', '조인은 조건에 맞는 행 쌍을 만든다. 오른쪽 여러 행과 일치하면 왼쪽 한 행이 결과에 여러 번 나타난다. INNER JOIN은 불일치를 제외하고 LEFT JOIN은 왼쪽을 보존한다. 키 유일성과 관계를 확인한다.', pg+'tutorial-join.html'],
    ['기본키와 외래키로 관계 지키기', '기본키는 행을 유일하게 식별하며 NULL이 될 수 없다. 외래키는 다른 키를 참조하는 무결성 제약이다. 외래키만으로 중복 주문을 막거나 조회 속도를 보장하지 않는다.', pg+'ddl-constraints.html'],
    ['정렬과 LIMIT로 작은 결과 만들기', 'LIMIT는 반환 행 수를 제한하지만 어떤 행인지 정하려면 ORDER BY가 필요하다. 같은 정렬 값에는 고유키를 보조 정렬로 써 안정적인 순서를 만든다. 페이지 사이 데이터 변경은 여전히 결과에 영향을 준다.', pg+'queries-limit.html'],
    ['시간 데이터에는 기준이 필요하다', 'PostgreSQL timestamp without time zone과 timestamptz는 다르다. timestamptz는 시점을 보관하고 세션 시간대에 맞춰 표시하며 원래 시간대 이름을 보존하지 않는다. 하루 집계는 업무 시간대 경계를 정의한다.', pg+'datatype-datetime.html'],
    ['뷰는 저장된 질문이다', '일반 뷰는 쿼리에 이름을 붙인 것으로 조회 때 기반 데이터를 읽는다. 뷰를 만들었다고 별도 데이터 사본이 생기지는 않는다. materialized view는 결과를 저장해 갱신이 필요하다. 일반 뷰에 초점을 맞춘다.', pg+'tutorial-views.html'],
  ],
  'cs-fundamentals': [
    ['인덱스가 검색을 줄이는 방법', '인덱스는 추가 자료구조로 검색을 돕지만 저장 공간과 쓰기 유지 비용이 든다. 작은 테이블이나 많은 행 조회에서는 순차 스캔이 나을 수 있다. 인덱스는 결과 순서를 자동 보장하지 않는다.', pg+'indexes-intro.html'],
    ['트랜잭션으로 작업 경계 만들기', '트랜잭션은 여러 변경을 하나의 전부 성공 또는 전부 취소 단위로 묶는다. COMMIT은 확정, ROLLBACK은 취소다. 데이터베이스 트랜잭션이 외부 이메일 전송까지 자동 취소하지는 않는다.', pg+'tutorial-transactions.html'],
    ['동시에 읽고 쓰면 생기는 일', '두 요청이 같은 이전 값을 읽고 갱신하면 변경 손실이 날 수 있다. 원자적인 UPDATE 또는 적절한 행 잠금·격리 수준이 필요하다. 트랜잭션 사용만으로 모든 동시성 문제가 사라지지 않는다.', pg+'transaction-iso.html'],
    ['잠금은 순서를 만들고 대기도 만든다', '행 잠금은 충돌하는 작업을 대기시킬 수 있다. 긴 트랜잭션은 대기를 늘린다. 서로 다른 순서로 자원을 잠그면 교착 상태가 생길 수 있어 일관된 접근 순서와 재시도 전략을 쓴다.', pg+'explicit-locking.html'],
    ['캐시는 빠르지만 최신일까?', '캐시는 재사용할 응답을 저장해 지연과 부하를 줄인다. 신선도·유효기간·재검증을 정해야 한다. HTTP no-cache는 저장 금지가 아니라 사용 전 재검증이고 no-store는 저장하지 말라는 지시다.', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching'],
    ['재시도해도 한 번처럼 처리하기', '멱등성은 동일 요청을 반복해도 의도한 서버 효과가 같은 성질이다. 네트워크 타임아웃은 처리 실패를 증명하지 않는다. 결제 같은 작업은 고유 요청 키와 저장된 처리 결과 등 서버 중복 제어가 필요하다.', 'https://developer.mozilla.org/en-US/docs/Glossary/Idempotent'],
    ['프로세스와 스레드의 경계', '프로세스는 실행 자원의 경계이고 같은 프로세스의 스레드는 주소 공간 등 자원을 공유한다. 공유 상태에 동기화가 필요하다. 스레드 수를 늘려도 경합·작업 성격에 따라 속도가 늘지 않을 수 있다.', 'https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads'],
    ['복제와 백업은 다른 대비다', '복제는 변경을 다른 서버로 전달해 가용성을 도울 수 있다. 잘못된 삭제도 복제될 수 있으므로 과거 상태로 복원하는 백업과 다르다. 복구 가능성은 실제 복원 시험으로 확인한다.', pg+'high-availability.html'],
  ],
  'deep-learning': [
    ['학습과 추론은 무엇이 다를까?', '학습은 데이터와 목표를 바탕으로 모델 파라미터를 조정한다. 추론은 학습된 파라미터로 새 입력의 출력을 계산한다. 일반적인 배포 추론에서 사용자 질문만으로 모델 가중치가 바로 갱신되지는 않는다.', ml+'glossary'],
    ['입력 특징과 정답 라벨 구분하기', '지도학습에서 특징은 예측에 쓰는 입력, 라벨은 학습할 목표값이다. 예측 시 알 수 없는 정답 관련 정보를 특징에 넣으면 데이터 누수가 된다. 숫자가 많다고 항상 좋은 특징은 아니다.', ml+'intro-to-ml/supervised'],
    ['손실은 예측이 틀린 정도를 잰다', '손실 함수는 예측과 목표의 차이를 수치로 평가한다. 손실을 줄이는 것이 훈련 목표이며 훈련 손실 감소만으로 새 데이터 성능 향상을 보장하지 않는다. 평균 제곱 오차의 큰 오차에 대한 민감성을 작은 숫자 예로 설명한다.', ml+'crash-course/linear-regression/loss'],
    ['경사하강법과 학습률', '경사하강법은 손실의 기울기를 이용해 파라미터를 조정한다. 학습률은 한 번의 조정 크기를 좌우한다. 너무 크면 발산·진동, 너무 작으면 느린 학습이 될 수 있다. 항상 전역 최솟값을 찾는다는 보장은 없다.', ml+'crash-course/linear-regression/gradient-descent'],
    ['훈련·검증·테스트를 나누는 이유', '훈련 데이터는 파라미터 학습, 검증 데이터는 모델·설정 선택, 테스트는 최종 성능 추정에 쓴다. 테스트를 계속 보고 조정하면 평가가 낙관적으로 치우칠 수 있다. 시간·사용자 중복 누수를 고려한다.', ml+'crash-course/overfitting/dividing-datasets'],
    ['훈련 문제만 잘 푸는 과적합', '과적합은 훈련 데이터에 지나치게 맞춰 새 데이터 일반화가 나빠지는 현상이다. 훈련과 검증 성능 차이를 본다. 정규화·적절한 모델 용량·데이터 개선·조기 종료가 도움이 될 수 있으나 만능은 아니다.', ml+'crash-course/overfitting/overfitting'],
    ['신경망에 비선형 변환이 필요한 이유', '선형 변환만 여러 층 합성해도 전체는 선형 변환이다. 비선형 활성화는 복잡한 관계를 표현하도록 돕는다. 층을 늘리는 것만으로 항상 성능이 좋아지는 것은 아니다. 뇌를 그대로 복제했다는 비유를 피한다.', ml+'crash-course/neural-networks/nodes-hidden-layers'],
    ['정확도 하나로 충분하지 않을 때', '드문 양성 문제에서는 모두 음성으로 예측해도 정확도가 높을 수 있다. 정밀도는 양성 예측 중 실제 양성 비율, 재현율은 실제 양성 중 찾아낸 비율이다. 놓침과 오탐의 비용을 함께 본다.', ml+'crash-course/classification/accuracy-precision-recall'],
  ],
  llm: [
    ['다음 토큰을 예측한다는 것', '토큰은 텍스트를 나눈 처리 단위로 단어와 일대일이 아니다. 자동회귀 언어 모델은 문맥에 따른 다음 토큰 분포를 이용해 이어 쓴다. 그럴듯한 문장이 사실이라는 보장은 없다.', ml+'crash-course/llm'],
    ['문맥 창은 영구 기억이 아니다', '문맥 창은 한 요청에서 다루는 토큰 범위다. 대화 기록·검색 문서·지시와 생성 출력이 한도에 영향을 줄 수 있다. 이전 대화 저장과 모델 가중치 학습은 다른 문제이며 제품이 기록을 다시 넣을 수 있다.', ml+'glossary'],
    ['지시·자료·출력 형식을 분리하기', '프롬프트에서 작업 목표와 입력 자료, 출력 형식을 명확히 구분하면 모호함을 줄인다. 예시와 제약도 점검한다. 구분자나 엄격한 지시만으로 사실성이나 보안을 보장하지 않는다.', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct'],
    ['생성의 다양성과 사실성은 다르다', '온도 같은 샘플링 설정은 다음 토큰 선택의 무작위성에 영향을 준다. 낮은 온도도 사실 오류를 없애거나 완전 동일 출력을 보장하지 않는다. 공급사·모델별 지원 범위를 확인한다.', ml+'glossary'],
    ['임베딩은 의미를 비교하는 좌표다', '임베딩은 데이터를 숫자 벡터로 표현한다. 같은 임베딩 공간의 유사도로 검색 후보를 찾을 수 있으나 유사성이 사실 일치나 접근 권한을 뜻하지 않는다. 다른 모델의 벡터를 그냥 섞어 비교하지 않는다.', ml+'crash-course/embeddings'],
    ['RAG는 자료를 찾아 답변에 넣는다', 'RAG는 검색 결과를 생성 입력에 제공하는 접근이다. 모델 파라미터를 매 요청 학습시키는 것은 아니다. 검색 품질·자료 최신성·인용과 답변의 일치가 중요하고 환각을 완전히 없애지는 않는다.', ml+'glossary'],
    ['파인튜닝과 검색은 다른 도구다', '파인튜닝은 추가 학습으로 파라미터를 조정하고 RAG는 검색 자료를 입력에 넣는다. 응답 형식·행동 적응과 최신 자료 참조는 다른 요구이며 함께 쓸 수 있다. 파인튜닝이 지식을 완벽히 저장하는 방식은 아니다.', ml+'glossary'],
    ['LLM 답변도 시험 문제집이 필요하다', '평가는 대표 사례와 실패 사례·기대 기준을 정해 변경 전후 비교한다. 정확성·형식·근거·지연 등 목표별 기준을 쓴다. 개발에 반복 사용한 평가와 최종 홀드아웃을 구분하고 모델 채점만 맹신하지 않는다.', 'https://docs.anthropic.com/en/docs/test-and-evaluate/define-success'],
  ],
  'ai-security': [
    ['읽을 자료가 명령으로 바뀌는 순간', '프롬프트 인젝션은 신뢰할 수 없는 입력이 모델 행동을 바꾸도록 유도하는 위험이다. 외부 문서의 명령문은 자료이지 권한 있는 지시가 아니다. 프롬프트 문구만으로 완벽 차단되지 않는다.', ga+'llm01-prompt-injection/'],
    ['모델 입력 전에 비밀을 줄이기', '민감정보가 프롬프트·로그·응답·학습자료에 들어가면 노출 위험이 생긴다. 필요 최소 정보만 보내고 자격증명은 별도 보관한다. 모델에게 비밀을 말하지 말라고 쓰는 것만으로는 충분하지 않다.', ga+'llm022025-sensitive-information-disclosure/'],
    ['도구를 쓸 수 있다는 것과 허용은 다르다', '에이전트의 기능·권한·자율성을 과도하게 주면 피해 범위가 커진다. 조회와 수정 권한을 구분하고 중요한 실행은 서버 권한 검사와 사용자 확인을 거친다. 모델이 승인했다고 실제 권한이 생기지 않는다.', ga+'llm062025-excessive-agency/'],
    ['모델 출력도 검증할 입력이다', '모델 출력을 그대로 HTML·SQL·셸 명령으로 실행하면 위험하다. 맥락에 맞는 출력 인코딩, 매개변수화, 허용된 동작 검증을 사용한다. JSON 형식 검증만으로 값의 권한과 안전성이 보장되지는 않는다.', ga+'llm052025-improper-output-handling/'],
    ['RAG 검색에도 접근 권한이 필요하다', '벡터 검색에서 사용자별 접근 제어가 빠지면 비공개 문서가 모델 입력에 섞일 수 있다. 검색 단계부터 권한 범위를 적용하고 인용·로그에도 같은 제한을 적용한다. 임베딩 변환은 익명화 보장이 아니다.', ga+'llm082025-vector-and-embedding-weaknesses/'],
    ['학습 데이터가 오염되면', '데이터·모델 중독은 학습·미세조정 등 공급 과정에 악성 데이터나 변경을 넣어 행동을 왜곡할 수 있다. 출처·버전·변경 이력과 검증을 관리한다. 인젝션과 학습 데이터 오염을 같은 단계로 설명하지 않는다.', ga+'llm042025-data-and-model-poisoning/'],
    ['토큰과 도구 호출에 한도를 두기', '제한 없는 입력·출력·반복 도구 호출은 비용과 가용성 위험을 만든다. 사용자·작업별 토큰·시간·호출 횟수 상한, 취소·속도 제한이 필요하다. 한 요청의 최대 토큰만으로 전체 반복 실행 비용이 제한되지 않는다.', ga+'llm102025-unbounded-consumption/'],
    ['그럴듯한 답변을 검증하는 절차', '잘못된 정보와 과도한 신뢰가 의사결정 위험을 만든다. 원자료 대조·출처 확인·중요 작업의 검토 절차를 둔다. 유창함과 자신감은 정확도의 증거가 아니며 인용 링크도 내용을 실제로 뒷받침하는지 확인한다.', ga+'llm092025-misinformation/'],
  ],
  security: [
    ['인증과 인가는 다른 질문이다', '인증은 누구인지 확인, 인가는 무엇을 허용할지 판단한다. 로그인된 사용자도 다른 사람의 저장글을 수정할 수 없어야 한다. 객체마다 소유권·권한을 서버에서 확인한다.', ow+'Authorization_Cheat_Sheet.html'],
    ['기본 거부와 최소 권한', '기본 거부는 명시적으로 허용하지 않은 접근을 거부한다. 최소 권한은 작업에 필요한 범위만 준다. 화면 버튼 숨김만으로 API 접근을 막지 못하고 요청마다 서버 검사가 필요하다.', ow+'Authorization_Cheat_Sheet.html'],
    ['비밀번호는 되돌리는 암호문이 아니다', '비밀번호는 적절한 느린 비밀번호 해시 함수와 사용자별 salt로 저장한다. 일반 빠른 해시만으로는 부족하다. salt는 동일 비밀번호의 해시 일치를 줄이지만 약한 비밀번호를 강하게 만들지는 않는다.', ow+'Password_Storage_Cheat_Sheet.html'],
    ['세션 쿠키를 지키는 세 가지 속성', 'Secure는 HTTPS 전송 제한, HttpOnly는 자바스크립트의 쿠키 읽기 제한, SameSite는 교차 사이트 전송 제어다. 각각 다르며 HttpOnly가 모든 XSS 행동을 막는 것은 아니다. 로그아웃·만료 시 서버 세션도 고려한다.', ow+'Session_Management_Cheat_Sheet.html'],
    ['입력과 SQL 명령을 분리하기', '문자열 연결로 사용자 입력을 SQL에 섞으면 쿼리 의미가 바뀔 수 있다. 매개변수화 쿼리로 데이터와 명령을 분리한다. 테이블명·정렬 방향 같은 식별자는 별도 허용 목록 검증이 필요하다.', ow+'SQL_Injection_Prevention_Cheat_Sheet.html'],
    ['브라우저에 문자열을 안전하게 보여주기', 'XSS는 신뢰할 수 없는 데이터가 브라우저에서 코드로 실행되는 위험이다. 출력 맥락별 인코딩과 안전한 DOM API를 쓴다. textContent와 HTML 삽입은 다르다. HTML을 허용해야 하면 적절한 정화가 필요하다.', ow+'Cross_Site_Scripting_Prevention_Cheat_Sheet.html'],
    ['CSRF는 로그인 상태를 악용한다', '브라우저가 자동 첨부하는 인증정보를 이용해 원치 않는 상태 변경을 유도할 수 있다. CSRF 토큰·Origin 검사·SameSite 등 상황에 맞는 방어를 결합한다. GET으로 상태를 바꾸지 않는다. CORS만으로 모든 CSRF를 막지 못한다.', ow+'Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html'],
    ['로그에 남길 것과 남기지 말 것', '인증 실패·권한 거부·주요 변경은 조사에 도움 된다. 비밀번호·접근 토큰·과도한 개인정보는 기록하지 않는다. 로그 접근 권한·보관 기간·무결성을 관리하고 로그만으로 보안을 대체하지 않는다.', ow+'Logging_Cheat_Sheet.html'],
  ],
};
export const ORIGINAL_BRIEFS: OriginalBrief[] = Object.entries(groups).flatMap(([domain, rows]) => rows.map(([title, facts, url], i) => ({
  key: `${domain}-${String(i+1).padStart(2,'0')}`, domain: domain as CategorySlug, order: i+1, title, facts, url,
})));
