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
    "textSha256": "f07febf692f550822d6b22949929a9ba83efc3b8f7365ad002d59adbe4e19665",
    "acquiredAt": "2026-10-21T08:56:20.210Z",
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
  }
};
