"use client";

import { useCallback, useEffect, useState } from "react";

import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { DomainRow } from "@/lib/supabase/types";
import type { DomainTerms } from "@/lib/terms";
import { useQueryParams } from "@/lib/use-query";

/**
 * 첫 진입. 로그인부터 받고, 그다음 분야와 수준을 고른다. 게스트로 먼저 읽게
 * 하던 방식은 접었다(OnboardingFlow의 `SignIn` 주석).
 *
 * 로그인 화면이 여기 있으므로 `/api/onboarding`은 세션이 없어도 200이어야 하고,
 * 실제로 그렇다 — `domains`와 `domain_terms`는 RLS가 전체 읽기를 허용한다.
 */

type Data = {
  domains: DomainRow[];
  levels: Record<string, number>;
  domainTerms: Record<string, DomainTerms>;
  isSignedIn: boolean;
};

export default function OnboardingPage() {
  const query = useQueryParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    apiJson<Data>("/api/onboarding")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || !query) return <PageLoading label="준비하고 있어요" />;

  return (
    <OnboardingFlow
      domains={data.domains}
      initialLevels={data.levels}
      domainTerms={data.domainTerms}
      // 딥링크·웹 콜백이 실패하면 ?error=auth로 돌아온다. 그냥 두면 사용자는
      // 구글에 다녀왔는데 아무 말 없이 화면만 바뀐 것으로 본다.
      authFailed={query.get("error") === "auth"}
      isSignedIn={data.isSignedIn}
    />
  );
}
