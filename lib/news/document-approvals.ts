import type { Attribution } from "../content-rights";

/** Reviewed 2026-10-22: only these exact selected texts may enter automatic processing.
 * A changed body needs a new review/hash; source permission is still checked at runtime.
 * Evidence: local docs/legal/document-acquisition-20261022.md and acquisition snapshots.
 */
export const DOCUMENT_APPROVALS: Readonly<Record<string, { textSha256: string; acquiredAt: string; attribution: Attribution }>> = {
  "google-ml-language-models": {
    "textSha256": "8e9025c49c8e5aea62809be058f585a7e954ca82161b84208ead4022528dffb9",
    "acquiredAt": "2026-10-21T08:56:14.483Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Introduction to Large Language Models",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-compute-instances": {
    "textSha256": "10eaa71388c3325a136f457514afbd0613906888566454cf6a0873bd337c345d",
    "acquiredAt": "2026-10-21T08:56:17.667Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Compute Engine instances",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-storage-objects": {
    "textSha256": "e3494dd0ba6cfe530030df3d93e218f96cc461745d9ec71e338b983ea176c465",
    "acquiredAt": "2026-10-22T07:36:04.000Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "About Cloud Storage objects",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "owasp-genai-prompt-injection": {
    "textSha256": "12c0561d2383c40a2a240387d03e84ce26cacb5f76688dc761e546a89ffb8b92",
    "acquiredAt": "2026-10-21T08:56:21.579Z",
    "attribution": {
      "author": "OWASP GenAI Security Project contributors",
      "originalTitle": "LLM01:2025 Prompt Injection",
      "licenseLabel": "원문 및 가공 본문·파생 학습 자료 CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "OWASP and the OWASP logo are trademarks of the OWASP Foundation, Inc. Unless otherwise specified, all content on the site is Creative Commons Attribution-ShareAlike v4.0 and provided without warranty of service or accuracy. General Disclaimer: https://owasp.org/www-policy/operational/general-disclaimer.html — Copyright © 2025 OWASP Foundation, Inc. 번역·재작성 및 파생 학습 자료에도 CC BY-SA 4.0을 적용합니다."
    }
  },
  "owasp-genai-information-disclosure": {
    "textSha256": "52a0cc95a607088689fc474ea56cbf96eb45642272a40e0b0f5d934f3818d48a",
    "acquiredAt": "2026-10-21T08:56:22.481Z",
    "attribution": {
      "author": "OWASP GenAI Security Project contributors",
      "originalTitle": "LLM02:2025 Sensitive Information Disclosure",
      "licenseLabel": "원문 및 가공 본문·파생 학습 자료 CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "OWASP and the OWASP logo are trademarks of the OWASP Foundation, Inc. Unless otherwise specified, all content on the site is Creative Commons Attribution-ShareAlike v4.0 and provided without warranty of service or accuracy. General Disclaimer: https://owasp.org/www-policy/operational/general-disclaimer.html — Copyright © 2025 OWASP Foundation, Inc. 번역·재작성 및 파생 학습 자료에도 CC BY-SA 4.0을 적용합니다."
    }
  },
  "owasp-authentication": {
    "textSha256": "0e1a03a77f31a7b338b7f676437c93c18b7eb543dcdf540eec28c5c6b6be7c32",
    "acquiredAt": "2026-10-21T08:56:23.541Z",
    "attribution": {
      "author": "Cheat Sheets Series Team",
      "originalTitle": "Authentication Cheat Sheet",
      "licenseLabel": "원문 및 가공 본문·파생 학습 자료 CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Copyright - Cheat Sheets Series Team. This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International. Preserve contributors and change notices; adaptations must retain the applicable ShareAlike license."
    }
  },
  "owasp-authorization": {
    "textSha256": "426134b595b0b0e7a3b04f8aa691078598450cbfb6de2c1166346b2533875d0c",
    "acquiredAt": "2026-10-21T08:56:24.059Z",
    "attribution": {
      "author": "Cheat Sheets Series Team",
      "originalTitle": "Authorization Cheat Sheet",
      "licenseLabel": "원문 및 가공 본문·파생 학습 자료 CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Copyright - Cheat Sheets Series Team. This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International. Preserve contributors and change notices; adaptations must retain the applicable ShareAlike license."
    }
  },
  "postgresql-querying": {
    "textSha256": "725825596e6e40efa2b0a53605874b512c841b2374e2598f93871cfe71ab3f48",
    "acquiredAt": "2026-10-21T08:56:26.391Z",
    "attribution": {
      "author": "PostgreSQL Global Development Group; The Regents of the University of California",
      "originalTitle": "Querying a Table",
      "licenseLabel": "PostgreSQL 문서 이용허락",
      "licenseUrl": "https://www.postgresql.org/docs/18/legalnotice.html",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Legal Notice PostgreSQL Database Management System (also known as Postgres, formerly known as Postgres95) Portions Copyright © 1996-2026, PostgreSQL Global Development Group Portions Copyright © 1994, The Regents of the University of California Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted, provided that the above copyright notice and this paragraph and the following two paragraphs appear in all copies. IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS ON AN “AS-IS” BASIS, AND THE UNIVERSITY OF CALIFORNIA HAS NO OBLIGATIONS TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS."
    }
  },
  "postgresql-indexes": {
    "textSha256": "d3e108009bfa9c1c883fc7680bc391c509cf3129a02aab7c14a4ad8fa139f5d7",
    "acquiredAt": "2026-10-21T08:56:26.980Z",
    "attribution": {
      "author": "PostgreSQL Global Development Group; The Regents of the University of California",
      "originalTitle": "Introduction to Indexes",
      "licenseLabel": "PostgreSQL 문서 이용허락",
      "licenseUrl": "https://www.postgresql.org/docs/18/legalnotice.html",
      "changes": "선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Legal Notice PostgreSQL Database Management System (also known as Postgres, formerly known as Postgres95) Portions Copyright © 1996-2026, PostgreSQL Global Development Group Portions Copyright © 1994, The Regents of the University of California Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted, provided that the above copyright notice and this paragraph and the following two paragraphs appear in all copies. IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS ON AN “AS-IS” BASIS, AND THE UNIVERSITY OF CALIFORNIA HAS NO OBLIGATIONS TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS."
    }
  },
  // 2026-11-18 batch (AI-assisted selection; evidence in local spike-out/document-batch-20261118).
  "google-cloud-compute-overview": {
    "textSha256": "342816d7b81511d248e0904d3c7a8977ede757f2a44bcb681373d97dd419f900",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Compute Engine overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-compute-regions-zones-best-practices-compute-region-selection": {
    "textSha256": "10d1cba30a06209ccbd756672d6d56d10f1549d8f5ca70d7b20f578527b18447",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Best practices for Compute Engine region and zone selection",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-kubernetes-engine-concepts-kubernetes-engine-overview": {
    "textSha256": "2f02b6004e0e58471996a4bc582d4e06bc2fbd0c32c3eb1628048616dfe64c2a",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "GKE overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-kubernetes-engine-concepts-cluster-architecture": {
    "textSha256": "bfb277957d208306f4bdc827091b87eb039914551b5f30ce9fa99bb12e81441b",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "GKE cluster architecture",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-kubernetes-engine-concepts-gke-and-cloud-run": {
    "textSha256": "c72d8b748edf8518154e6db5ae611e390707d506a94c314dd1fb964e524c2c1d",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "GKE and Cloud Run",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-run-about-instance-autoscaling": {
    "textSha256": "b1774589849efb96ffc6db3e78bb964b9285739cb7f7920ec605baf1dcddb661",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "About instance autoscaling in Cloud Run services",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-run-about-concurrency": {
    "textSha256": "04030d20ab3e360709bb7ca857c31b9272e016ca5f94af0caab541fe43c360af",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Maximum concurrent requests for services",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-load-balancing-https-global-applb-failover-overview": {
    "textSha256": "87d5876a6ff69c39e47eae1062fde2551efae51157535c08d119948ddce2cde1",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Failover for global external Application Load Balancers",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-pubsub-overview": {
    "textSha256": "9184fe974c7bca750de00385644f282fa0eee56793501081fc15d83cd4c3b6fd",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "What is Pub/Sub?",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-storage-introduction": {
    "textSha256": "3884050927c37e6aaf3478e032417be3750db1d9d33dee6fdc8a82f2a1679a62",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cloud Storage overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-sql-introduction": {
    "textSha256": "60fb600e43a563fdf3d6b4374c440bd1b3e916aa8e5a5c9f2d94d4a8e7bfeeae",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cloud SQL overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-vpc-overview": {
    "textSha256": "691d2a218503fc7b1f0669f63410bde14eb971cbafd59d3927f97495832fa362",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Virtual Private Cloud (VPC) overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-iam-overview": {
    "textSha256": "e76083ea667364a9fde55e1eda082f1268dbd885975780dc5f54112b94ad06b9",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "IAM overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-iam-service-account-overview": {
    "textSha256": "f6cfdedd8c92c98e32b67fdcb2c59cb8bf3e66fec26b68773a7f7b7ee92914fd",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Service accounts overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-iam-best-practices-for-managing-service-account-keys": {
    "textSha256": "527df3ebce404306f5515d102806a566d6997fb761fd3f855abe7b5f8b6b4739",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Best practices for managing service account keys",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-iam-federated-identity-architectures": {
    "textSha256": "9d73a5bc83906820351c59ff36ba0242e411c5a09c4c8a195770dfc4cc560727",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Architecture patterns for identity federation",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-kms-key-management-service": {
    "textSha256": "549469fd574b4dc00a1021b4024dce350e117aeb05fdaf717b050167bca289e2",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cloud Key Management Service overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-kms-protection-levels": {
    "textSha256": "679a78e58ca04bb18df326e659378762b4f92a0652419370a14bd1756d5a2d4a",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Protection levels",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-secret-manager-overview": {
    "textSha256": "ce0c436bae4b7563b6b9ebda43916a78078769d70ae3739bb5804b36a571f639",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Secret Manager overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-secret-manager-best-practices": {
    "textSha256": "176c89950e2feedf3468a0812b734f9fe797ebd1eb5b5b8012e931eb65e70836",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Secret Manager best practices",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-armor-cloud-armor-overview": {
    "textSha256": "64577d982ad8264bfe8e8c9d6b9b0607c33a9bf46712a744d35531ec58aa9076",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cloud Armor overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-armor-rate-limiting-overview": {
    "textSha256": "b26b84238e706b694d589147c7273f224df31886ded2250d51cdf624c2871ac7",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Rate limiting overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-binary-authorization-overview": {
    "textSha256": "7206209ce7be1f6379d4ebf1fbbbadbb82f98913cec4d063a7fb8812346206e5",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Binary Authorization overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-vpc-service-controls-overview": {
    "textSha256": "0c2848300be1ee2220112f59a59dc6c267d565da16462e49a80987aa8464d349",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Overview of VPC Service Controls",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-dns-dns-overview": {
    "textSha256": "b803ab7ccea418055729137795513badf786be2e3c109048721f945c60e9f874",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "General DNS overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-dns-records-overview": {
    "textSha256": "5d1316d1d496a24967c8f01d30dc51803bfc683410dcba75d4f3e435b50f6ce2",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "DNS records overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-dns-zones-zones-overview": {
    "textSha256": "3f03e1355c1a78f7dd61e3ec6f3305b556175da06efebec579fa2a9b97bec2f1",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "DNS zones overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-cdn-overview": {
    "textSha256": "afe72b2fd4d37ac5f82c66b1558bb275d47e1ca4966b5a2f3f9b3e6486db191d",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cloud CDN overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-cdn-cache-invalidation-overview": {
    "textSha256": "83390ad7871a5f60dd75c7c1d31e9b82e2aa13a0f196532de2a4008c78cc3a2b",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Cache invalidation overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-cdn-using-negative-caching": {
    "textSha256": "83afed44f0aebe791e5353893a8434aac10ae4b3d52d4374250bffa5d194e0d0",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Use negative caching",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-memorystore-redis-about-read-replicas": {
    "textSha256": "24735f05430a196f7b786b6c6967d4be884974ec4f70a1c61b5e9cd6832deea2",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "About read replicas",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-memorystore-redis-about-manual-failover": {
    "textSha256": "b1d52ecccd3f2e86fc61de9f69ecb3b210b055a59cfd257b265637cd48ed9742",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "About manual failover",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-memorystore-redis-about-rdb-snapshots": {
    "textSha256": "e8bd2768876fe2ab06a6a06998b7736836c5021f6dbbb70c06779fcaf89ad2c5",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "About RDB snapshots",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-spanner-true-time-external-consistency": {
    "textSha256": "564b8cdb6b1bdc6b139303e7d80472bd35ca70582f4f7ab51ad1c09cf5f419eb",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Spanner: TrueTime and external consistency",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-spanner-foreign-keys-overview": {
    "textSha256": "9efca13c950c50537df567425c85d53e8e484a95fbf4fe9dc98b5d6c72fd07d1",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Foreign keys",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-pubsub-exactly-once-delivery": {
    "textSha256": "3a151db7a6ef4992f864a1550a3a11dfdd30b1597623823dde09da7024e8d3af",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Exactly-once delivery",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-models-capabilities-configure-safety-filters": {
    "textSha256": "597c9e85d88a356bb7f642689d863992b7565859b0eb1996be03edcb99102c64",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Safety and content filters",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-gemini-enterprise-agent-platform-models-responsible-ai": {
    "textSha256": "b66b2a897c4bc5a35e4611c4b30b83b9708f64ab48e0d5337f8c656a9c99dfde",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Responsible AI",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-security-command-center-ai-protection-overview": {
    "textSha256": "ee1b98d661bb806974197dc880d0699100c6e798195fffff3b94422b05767e0b",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "AI Protection overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-security-command-center-concepts-data-security-overview": {
    "textSha256": "cf69ab7adbc8f4c4a0fd90a4dab55a7aceb1872d0b31a96442bfcc7ba388314b",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Data and infrastructure security overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-security-command-center-security-command-center-overview": {
    "textSha256": "10554ee2ed63850bcf4f09a8789873bb3a25a6acba9fa734b578ba1430631939",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Security Command Center overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-sensitive-data-protection-best-practices-for-mitigating-data-risk": {
    "textSha256": "f1a0607fddfd4c49f909a7f7ef897ac792c60aa53010ff722d2fa480bb11d37e",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Recommended strategies for mitigating data risk",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-sensitive-data-protection-evaluate-data-risk-management-needs": {
    "textSha256": "1a52c9613bc019949b65afa9d483f2147973c08670de13e0ad6a8c65a9ebf921",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Evaluate your data risk management needs",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-sensitive-data-protection-learn-about-your-data": {
    "textSha256": "9338f4ef0042b4d06107dc126435b57551e3e5f8f8473827a0b2fe2de27ea1e5",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Learn about your data through discovery and inspection",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-sensitive-data-protection-sensitive-data-protection-overview": {
    "textSha256": "ad412ff4b664033784987deacd87ab5f6c847317623ac77641339ce936a884ad",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Sensitive Data Protection overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-llm-transformers": {
    "textSha256": "feffdea1ddf196c5065a392c1681283b6bd37184d69ee576a989fbade2296673",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "LLMs: What's a large language model?",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-llm-tuning": {
    "textSha256": "e9422b0c3504ac6d4d5d8755e6f95b4e6ad17ca224c03f1b4127fee4d45d7d09",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "LLMs: Fine-tuning, distillation, and prompt engineering",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-models-context-cache-context-cache-overview": {
    "textSha256": "52328c5a3d0a8e96585aa1916cb3451ddac3653cab9dc5cb03c7999574783782",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Context caching overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-gemini-enterprise-agent-platform-models-embeddings": {
    "textSha256": "8ed2c13f27ca598c539acd3a4b39e3a36740b1d2eeb09c793e155ec5ae93e544",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Embeddings APIs overview",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-models-prompts-introduction-prompt-design": {
    "textSha256": "583c709009616bccb8ebb620fa0cb945b88288cfa9477e2b6fa86e44846f0e32",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Introduction to prompting",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-cloud-gemini-enterprise-agent-platform-models-tuning": {
    "textSha256": "fc4b6879429b59b05120a36f24abc43d14c0830146f8d4fc731d2853e587c3c0",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Introduction to tuning",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-categorical-data": {
    "textSha256": "c39ecc61542084dd667ac6b29f508892633f7cec4519fd14ec4834db8aa070be",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Working with categorical data",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-numerical-data": {
    "textSha256": "355337d50597efa47676118fb396dee081c119fb6292f74fa37a8758e754abe1",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Working with numerical data",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-overfitting": {
    "textSha256": "17f0acd306de5f1ae7736fe17c25f6e34436948aa522e6db7e8b4c49f4f3cf47",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Datasets, generalization, and overfitting",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-linear-regression-loss": {
    "textSha256": "32cb1ce36cc70ea22dc9470b888992ba288c71b02ca5bdb12a4fb52f8540413b",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Linear regression: Loss",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-crash-course-logistic-regression-loss-regularization": {
    "textSha256": "bf8df2c4c45b4fce513da918d20cea61a70fa9f1547b2f526735df94c52420e4",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Logistic regression: Loss and regularization",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-decision-forests": {
    "textSha256": "9a49345ce1e4b47a95df29c1117e7bc20eb8a8ed88af81c046cd5d6907b69d47",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Introduction",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-decision-forests-appropriate-data": {
    "textSha256": "0281f0e4dcbc7dfb96d4ab4ca69ff96490ba4d577522da5fe7e630361f8321fb",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Appropriate data for decision forests",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-clustering-kmeans-manual-similarity": {
    "textSha256": "6d0c00bae4d6ecc488f1de44c22d9db00ec78cb5230549b7fff5c597590595fe",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Manual similarity measure",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-clustering-dnn-clustering-supervised-similarity": {
    "textSha256": "b997eb37312de9ca3ca3f519d55fdea23a0c7a58b9818e03dceea7a4b25ad8cf",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Measuring similarity from embeddings",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-gan-loss": {
    "textSha256": "9936c1297bc7185cc34bd22e337910682491e41d62a688cbd810bd67307553af",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Loss Functions",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-problem-framing-problem": {
    "textSha256": "f442d23e8b5bf382501e61d1bf5e8c69d85da0ab8505738a8942ffaa692ca64c",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Understand the problem",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-problem-framing-implement-model": {
    "textSha256": "5edb9280a727a31787e54b6a69c78b10ceba39d7f46661390546d889591257b9",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Implementing a model",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  },
  "google-ml-recommendation-collaborative-basics": {
    "textSha256": "531c0e6466dfd71baca5e3332f0f170879b7f0173abdd3f0cb631d2085877aa9",
    "acquiredAt": "2026-11-18T17:43:56.223Z",
    "attribution": {
      "author": "Google",
      "originalTitle": "Collaborative filtering",
      "licenseLabel": "원문 CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "changes": "Google이 제공한 원문을 바탕으로 수정했습니다. 선정한 절을 한국어로 번역·요약하고 난이도별 설명, 용어 풀이와 학습용 퀴즈를 추가했습니다. 원문 이미지·영상은 제공하지 않습니다.",
      "notices": "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. 원문 미디어는 포함하지 않습니다. Google 사이트 정책: https://developers.google.com/terms/site-policies"
    }
  }
};
