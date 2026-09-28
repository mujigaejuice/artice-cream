/**
 * 앱 번들 빌드 (앱출시.md §2·§4, T2 스펙 §5).
 *
 *   npm run build:app   →  out/                        (플래그 없는 번들)
 *   npm run app:dev     →  out/ + cap sync android     (에뮬레이터용)
 *   npm run app:run     →  위 + 빌드·설치·실행
 *
 * `APP_EXPORT=1 next build`를 셸에 직접 적지 않는 이유는 문법이 갈리기 때문이다 —
 * PowerShell에는 `VAR=x cmd` 형태가 없고, cmd.exe는 또 다르다. 노드에서 환경변수를
 * 넣어 넘기면 한 명령이 어디서나 같이 돈다.
 *
 * `.next`를 먼저 지운다. 두 빌드가 `pageExtensions`가 다르고, Next가 만들어 둔
 * 라우트 타입 검증 파일(`.next/types/validator.ts`)이 지난 빌드의 라우트를 계속
 * 참조해 타입 체크에서 터진다.
 *
 * CAP_DEV는 next build와 cap sync 양쪽에 붙는다. capacitor.config.ts가 sync
 * 시점에 다시 읽혀 네이티브 프로젝트로 복사되기 때문이다.
 *
 * `npx cap run android`를 쓰지 않는다. Capacitor CLI가 `./gradlew`를 그대로 부르는데
 * Windows의 cmd.exe는 확장자 없는 스크립트를 실행하지 못한다. 그래서 gradle과 adb를
 * 여기서 직접 몬다 — 어느 플랫폼에서든 같은 명령이 돈다.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const mode = process.argv[2] ?? "build"; // build | dev | run
const dev = mode !== "build";
const win = process.platform === "win32";

const APP_ID = "com.articecream.app";
const APK = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");

// 에뮬레이터가 호스트를 보는 주소. 실기기는 LAN IP, 배포 뒤에는 https 주소.
const apiBase = process.env.APP_API_BASE ?? "http://10.0.2.2:3000";
const target = process.env.APP_TARGET;

const devEnv = { CAP_DEV: "1" };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    ...options,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * 동기 sleep. `timeout /t`는 콘솔 입력이 없으면 바로 에러로 끝나서 대기 루프가
 * 순식간에 소모된다. Atomics.wait는 자식 프로세스도 콘솔도 필요 없다.
 */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function capture(command, args) {
  const r = spawnSync(command, args, { encoding: "utf8", shell: true });
  return (r.stdout ?? "").trim();
}

/** gradle은 sdk.dir을 알아야 한다. 환경변수가 없으면 OS 기본 위치를 본다. */
function androidHome() {
  const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (fromEnv) return fromEnv;

  const guess = win
    ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Android", "Sdk")
    : process.platform === "darwin"
      ? join(homedir(), "Library", "Android", "sdk")
      : join(homedir(), "Android", "Sdk");

  if (existsSync(guess)) return guess;

  console.error(
    `Android SDK를 찾지 못했다. ANDROID_HOME을 설정하거나 ${guess}에 설치한다.`,
  );
  process.exit(1);
}

/** 붙어 있는 기기가 없으면 AVD를 띄우고 부팅을 기다린다. */
function ensureDevice(sdk) {
  const adb = join(sdk, "platform-tools", win ? "adb.exe" : "adb");

  const attached = capture(adb, ["devices"])
    .split("\n")
    .slice(1)
    .filter((line) => line.trim().endsWith("device"));

  if (attached.length > 0) return adb;

  if (!target) {
    console.error("붙어 있는 기기가 없다. APP_TARGET에 AVD 이름을 준다.");
    process.exit(1);
  }

  const emulator = join(sdk, "emulator", win ? "emulator.exe" : "emulator");
  console.log(`에뮬레이터를 띄운다: ${target}`);
  // spawnSync는 detached를 줘도 자식이 끝날 때까지 기다린다. 에뮬레이터는 끝나지
  // 않으므로 여기서 영영 멈춘다. 비동기 spawn + unref로 떼어 놓는다.
  const proc = spawn(emulator, ["-avd", target], {
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  proc.unref();

  run(adb, ["wait-for-device"]);
  // wait-for-device는 adb가 붙은 시점에 돌아온다. 부팅은 그다음이다.
  // 콜드 부팅은 몇 분 걸린다.
  for (let i = 0; i < 150; i++) {
    if (capture(adb, ["shell", "getprop", "sys.boot_completed"]) === "1") return adb;
    sleep(2000);
  }
  console.error("에뮬레이터가 부팅되지 않았다.");
  process.exit(1);
}

rmSync(".next", { recursive: true, force: true });

run("npx", ["next", "build"], {
  env: {
    APP_EXPORT: "1",
    ...(dev ? { ...devEnv, NEXT_PUBLIC_API_BASE: apiBase } : {}),
  },
});

if (dev) run("npx", ["cap", "sync", "android"], { env: devEnv });

if (mode === "run") {
  const sdk = androidHome();
  const gradleEnv = { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

  run(win ? ".\\gradlew.bat" : "./gradlew", ["assembleDebug", "--console=plain"], {
    cwd: "android",
    env: gradleEnv,
  });

  const adb = ensureDevice(sdk);
  run(adb, ["install", "-r", APK]);
  // 런처 인텐트로 띄운다. 액티비티 이름을 여기 박아 두지 않으려는 것이다.
  run(adb, ["shell", "monkey", "-p", APP_ID, "-c", "android.intent.category.LAUNCHER", "1"]);
}
