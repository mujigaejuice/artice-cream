/**
 * 보울 장면 뒤 배경 — ConeScene과 같은 네 장소를 가로(600×400) 구도로 다시 그렸다.
 * 색값·소재는 ConeScene과 같다. 고른 스쿱과 제목이 나오는 오른쪽 가운데
 * (x 400~600, y 120~320)에는 눈에 띄는 요소를 두지 않는다.
 */
const SCENES = ["night-sky", "pink-parlor", "turkish-stand", "evening-street"];

const STARS: Array<[number, number, number]> = [
  [24, 60, 2], [62, 118, 1.5], [96, 34, 2], [140, 88, 1.6], [176, 46, 2.1], [228, 120, 1.5],
  [262, 30, 2], [318, 82, 1.6], [364, 140, 1.3], [392, 52, 1.5], [430, 98, 1.2], [462, 28, 1.7],
  [588, 108, 1.2], [40, 196, 1.3], [118, 172, 1], [190, 214, 1.5], [270, 188, 1.2], [340, 230, 1.1],
  [12, 262, 1.2], [84, 248, 1.4],
];

export function BowlBackdrop({ scene }: { scene: string | undefined }) {
  if (!scene || !SCENES.includes(scene)) return null;
  return <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 400"
    preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {scene === "night-sky" && <>
      <rect width="600" height="400" fill="#202448" />
      <path d="M0 282 Q130 238 260 274 T600 262 V400 H0Z" fill="#30365C" />
      <path d="M0 332 Q150 296 300 324 T600 306 V400 H0Z" fill="#3A4266" />
      <circle cx="520" cy="70" r="29" fill="#FFF0CF" opacity=".95" />
      <circle cx="532" cy="62" r="27" fill="#202448" />
      {STARS.map(([x, y, r], i) =>
        <circle key={i} cx={x} cy={y} r={r} fill="#FFE9C9" opacity={i % 3 === 0 ? ".9" : ".65"} />)}
      <g fill="none" strokeLinecap="round">
        <path d="M30 150 111 83" stroke="#B6C9E8" strokeWidth="7" opacity=".18" />
        <path d="M30 150 111 83" stroke="#F9E5CA" strokeWidth="2.5" />
        <path d="M200 112 291 37" stroke="#B6C9E8" strokeWidth="8" opacity=".18" />
        <path d="M200 112 291 37" stroke="#F9E5CA" strokeWidth="2.6" />
        <path d="M352 104 420 49" stroke="#B6C9E8" strokeWidth="7" opacity=".18" />
        <path d="M352 104 420 49" stroke="#F9E5CA" strokeWidth="2" />
      </g>
      <g fill="#FFF3DC"><circle cx="111" cy="83" r="3.4" /><circle cx="291" cy="37" r="3.7" />
        <circle cx="420" cy="49" r="2.8" /></g>
    </>}
    {scene === "pink-parlor" && <>
      <rect width="600" height="400" fill="#FFE7EB" />
      <rect y="300" width="600" height="100" fill="#F0C7CC" />
      <path d="M0 332h600M0 368h600M60 300v100M180 300v100M300 300v100M420 300v100M540 300v100"
        stroke="#E0ADB6" strokeWidth="2" opacity=".7" />
      <rect x="28" y="52" width="544" height="248" rx="14" fill="#F9D0D9" stroke="#D690A7" strokeWidth="5" />
      <rect x="55" y="140" width="210" height="130" rx="8" fill="#FFF8F1" stroke="#BD7990" strokeWidth="5" />
      <path d="M55 205h210M160 140v130" stroke="#D9A4AC" strokeWidth="4" />
      <path d="M70 172q30-22 58 0m60 6q25-23 49 0" stroke="#F9C4D1" strokeWidth="5" fill="none" />
      <rect x="20" y="92" width="560" height="34" fill="#E985A1" />
      {Array.from({ length: 14 }, (_, i) => <path key={i}
        d={`M${20 + i * 40} 92h40l-7 42h-26Z`} fill={i % 2 ? "#FFF5EC" : "#EF9DB4"} />)}
      <path d={`M20 134${" q20 16 40 0".repeat(14)}`} fill="none" stroke="#D57E9C" strokeWidth="3" />
      <rect x="238" y="38" width="124" height="42" rx="20" fill="#FFF9F3" stroke="#C97994" strokeWidth="4" />
      <path d="M286 63l8-16h13l8 16Z" fill="#DEB279" stroke="#9C6B5A" strokeWidth="2" />
      <circle cx="301" cy="48" r="10" fill="#EE91B0" /><circle cx="318" cy="58" r="3" fill="#D95073" />
      <path d="M58 286h484" stroke="#B76E88" strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(0 -52)">
        <g fill="#7DA889"><path d="M21 350q-11-38 2-49 15 24 5 49Z" /><path d="M38 352q-2-46 17-55 4 28-10 55Z" /></g>
        <path d="M12 348h53l-8 34H20Z" fill="#D7879E" />
      </g>
      <g transform="translate(240 -52)">
        <g fill="#7DA889"><path d="M339 350q11-38-2-49-15 24-5 49Z" /><path d="M322 352q2-46-17-55-4 28 10 55Z" /></g>
        <path d="M295 348h53l-8 34h-37Z" fill="#D7879E" />
      </g>
    </>}
    {scene === "turkish-stand" && <>
      <rect width="600" height="400" fill="#FCE7CE" />
      <circle cx="520" cy="64" r="43" fill="#F8CD8C" opacity=".8" />
      <path d="M0 284q140-50 290-12t310-8v136H0Z" fill="#EFC6AC" />
      <rect y="320" width="600" height="80" fill="#DBB599" />
      <path d="M0 346h600M60 320v80M180 320v80M300 320v80M420 320v80M540 320v80" stroke="#C8987D" strokeWidth="2" />
      <path d="M40 46h520" stroke="#9E6656" strokeWidth="5" />
      {[80, 170, 260, 350, 440].map(x => <circle key={x} cx={x} cy="47" r="7" fill="#F6D287" />)}
      <path d="M20 70h560l-14 56H34Z" fill="#F8EEE2" stroke="#A65A52" strokeWidth="4" />
      {Array.from({ length: 14 }, (_, i) => <path key={i}
        d={`M${21 + i * 40} 70h40l-5 56h-30Z`} fill={i % 2 ? "#FFF4E6" : "#C96B67"} />)}
      <path d={`M34 126${" q19 16 38 0".repeat(14)}`} fill="none" stroke="#A65A52" strokeWidth="4" />
      <path d="M26 128v192m548-192v192" stroke="#8F5952" strokeWidth="8" strokeLinecap="round" />
      <path d="M110 58v80m0 0q21 11 26-4" stroke="#805A49" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M211 229h183" stroke="#8F5952" strokeWidth="4" />
      <path d="M230 228v-18m72 18v-24m72 24v-18" stroke="#8F5952" strokeWidth="3" />
      <path d="M224 209q8-10 16 0m54-5q8-10 16 0m56 5q8-10 16 0" fill="none" stroke="#E7AE8A" strokeWidth="5" />
      <path d="M213 284v-32q17-33 35 0v32Zm70 0v-39q17-35 36 0v39Zm71 0v-32q17-33 35 0v32Z"
        fill="#F8D6A0" stroke="#9F6551" strokeWidth="4" />
      <rect x="180" y="290" width="240" height="50" rx="9" fill="#B97957" stroke="#845344" strokeWidth="5" />
      <rect x="196" y="302" width="208" height="16" rx="4" fill="#DAA47B" />
    </>}
    {scene === "evening-street" && <>
      <rect width="600" height="400" fill="#DCD8E7" />
      <circle cx="520" cy="70" r="39" fill="#F9E2B7" />
      <rect x="0" y="118" width="93" height="182" fill="#AFAFC5" />
      <path d="M0 118 47 71l46 47" fill="#B7ADC2" />
      <rect x="103" y="160" width="50" height="140" fill="#C5B9C8" />
      <rect x="163" y="196" width="44" height="104" fill="#ADAFC5" />
      <rect x="506" y="132" width="94" height="168" fill="#BFAFC0" />
      <path d="m506 132 47-50 47 50" fill="#C9BBC8" />
      <rect x="440" y="178" width="56" height="122" fill="#C5B9C8" />
      <g fill="#F7DEB7" stroke="#8B879E" strokeWidth="3">
        <rect x="21" y="150" width="25" height="38" rx="3" /><rect x="54" y="150" width="25" height="38" rx="3" />
        <rect x="21" y="214" width="25" height="38" rx="3" /><rect x="54" y="214" width="25" height="38" rx="3" />
        <rect x="116" y="184" width="24" height="34" rx="3" />
      </g>
      <path d="M0 300h600v100H0Z" fill="#ACA8B8" />
      <path d="M250 300 110 400M350 300l140 100M0 332h600M0 372h600" stroke="#CFC7C9" strokeWidth="4" />
      <path d="M250 300h100" stroke="#E7D8CA" strokeWidth="6" />
      <path d="M230 296V112m0 0q0-23 27-23m-27 25h35" stroke="#545363" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M252 114q0 27 13 27t13-27Z" fill="#FFF0C9" stroke="#726979" strokeWidth="3" />
      <path d="M396 296V132m0 0q0-20-20-20m20 22h-30" stroke="#545363" strokeWidth="5" fill="none" />
      <path d="M366 133q0 21-11 21t-11-21Z" fill="#FFF0C9" stroke="#726979" strokeWidth="3" />
      <path d="M80 296q11-26 23 0m464 0q10-26 22 0" stroke="#708C7B" strokeWidth="8" fill="none" />
    </>}
  </svg>;
}
