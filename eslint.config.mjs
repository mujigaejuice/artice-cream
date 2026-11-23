import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 화면 데이터는 마운트 뒤 effect에서 불러온다(예전 정적 내보내기 구조의 흔적).
      // 요청 시작 시 로딩·오류 상태를 초기화하는 setState가 이 규칙에 걸리지만 의도된 패턴이다.
      // 새 코드에서는 피하고, 기존 코드는 화면별로 정리할 때 고친다.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // 검사·운영 스크립트는 Supabase 응답 모의 객체를 느슨하게 다룬다.
    files: ["scripts/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spike-out/**",
    "supabase/.temp/**",
    ".superpowers/**",
    // 로컬 시안 (git 제외)
    "artice-cream-flow.jsx",
    "scoop-cone.jsx",
  ]),
]);

export default eslintConfig;
