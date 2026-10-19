"use client";

import { useCallback, useEffect, useState } from "react";

import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import { createClient } from "@/lib/supabase/client";
import type { DomainRow } from "@/lib/supabase/types";
import type { DomainTerms } from "@/lib/terms";
import { useQueryParams } from "@/lib/use-query";

/**
 * 첫 진입. 소개 → 로그인 → 분야와 수준 선택. 게스트로 먼저 읽게
 * 하던 방식은 접었다(OnboardingFlow의 `SignIn` 주석).
 *
 * 세션이 없으면 API를 기다리지 않고 공개 소개를 연다. 실제 분야·수준은 로그인
 * 후 `/api/onboarding`의 인증 확인을 거쳐 가져온다.
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
    createClient().auth.getSession()
      .then(({ data: { session }, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (!session || session.user.is_anonymous) {
          return { domains: [], levels: {}, domainTerms: {}, isSignedIn: false } satisfies Data;
        }
        return apiJson<Data>("/api/onboarding");
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || !query) return <PageLoading label="준비하고 있어요" />;

  return (
    <OnboardingFlow
      key={data.isSignedIn ? "signed-in" : "signed-out"}
      domains={data.domains}
      initialLevels={data.levels}
      domainTerms={data.domainTerms}
      // 딥링크·웹 콜백이 실패하면 ?error=auth로 돌아온다. 그냥 두면 사용자는
      // 구글에 다녀왔는데 아무 말 없이 화면만 바뀐 것으로 본다.
      authFailed={query.get("error") === "auth"}
      startAtLogin={query.get("step") === "login"}
      isSignedIn={data.isSignedIn}
      onSignedIn={load}
    />
  );
}
