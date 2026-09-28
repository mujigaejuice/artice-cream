import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 설정 (앱출시.md §4, T2 스펙 §4).
 *
 * `CAP_DEV=1`일 때만 cleartext와 mixed content를 연다. 배포된 API가 아직 없어서
 * 에뮬레이터가 호스트의 dev 서버(`http://10.0.2.2:3000`)를 보는데, WebView의
 * 오리진이 `https://localhost`라 그냥은 막히기 때문이다. 둘 다 문서가 개발용이라고
 * 못박은 플래그라 플래그 없는 빌드에는 들어가지 않는다.
 *
 * 이 파일은 `cap sync` 시점에 읽혀 `android/app/src/main/assets`로 복사된다.
 * 그래서 sync에도 CAP_DEV가 붙어야 한다(scripts/build-app.mjs).
 */
const dev = process.env.CAP_DEV === "1";

const config: CapacitorConfig = {
  appId: "com.articecream.app",
  appName: "artice cream",
  webDir: "out",
  android: { allowMixedContent: dev },
  ...(dev ? { server: { cleartext: true } } : {}),
};

export default config;
