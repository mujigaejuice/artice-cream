/** Quiet illustrated places behind the cone. All shapes remain vector assets in the app bundle. */
export function ConeScene({ scene }: { scene: string | undefined }) {
  if (!scene || !["night-sky", "pink-parlor", "turkish-stand", "evening-street"].includes(scene)) return null;
  return <svg className="pointer-events-none absolute inset-0 h-full w-full rounded-3xl"
    viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {scene === "night-sky" && <>
      <rect width="360" height="480" fill="#202448" />
      <path d="M0 330 Q78 277 156 324 T360 304 V480 H0Z" fill="#30365C" />
      <path d="M0 390 Q92 344 183 383 T360 352 V480 H0Z" fill="#3A4266" />
      <circle cx="289" cy="86" r="29" fill="#FFF0CF" opacity=".95" />
      <circle cx="301" cy="78" r="27" fill="#202448" />
      {[[24,75,2],[55,143,1.5],[91,42,2],[127,102,1.6],[154,62,2.1],[195,135,1.5],
        [222,48,2],[329,146,1.6],[42,221,1.3],[112,196,1.2],[279,223,1.7],[338,272,1.2],
        [18,308,1.3],[77,278,1],[154,248,1.5],[240,301,1.2]].map(([x,y,r], i) =>
        <circle key={i} cx={x} cy={y} r={r} fill="#FFE9C9" opacity={i % 3 === 0 ? ".9" : ".65"} />)}
      <g fill="none" strokeLinecap="round">
        <path d="M34 160 115 93" stroke="#B6C9E8" strokeWidth="7" opacity=".18" />
        <path d="M34 160 115 93" stroke="#F9E5CA" strokeWidth="2.5" />
        <path d="M208 206 299 131" stroke="#B6C9E8" strokeWidth="8" opacity=".18" />
        <path d="M208 206 299 131" stroke="#F9E5CA" strokeWidth="2.6" />
        <path d="M270 324 338 269" stroke="#B6C9E8" strokeWidth="7" opacity=".18" />
        <path d="M270 324 338 269" stroke="#F9E5CA" strokeWidth="2" />
      </g>
      <g fill="#FFF3DC"><circle cx="115" cy="93" r="3.4" /><circle cx="299" cy="131" r="3.7" />
        <circle cx="338" cy="269" r="2.8" /></g>
    </>}
    {scene === "pink-parlor" && <>
      <rect width="360" height="480" fill="#FFE7EB" />
      <rect y="356" width="360" height="124" fill="#F0C7CC" />
      <path d="M0 388h360M0 430h360M50 356v124M140 356v124M230 356v124M320 356v124"
        stroke="#E0ADB6" strokeWidth="2" opacity=".7" />
      <rect x="28" y="52" width="304" height="304" rx="14" fill="#F9D0D9" stroke="#D690A7" strokeWidth="5" />
      <rect x="55" y="124" width="250" height="174" rx="8" fill="#FFF8F1" stroke="#BD7990" strokeWidth="5" />
      <path d="M55 218h250M180 124v174" stroke="#D9A4AC" strokeWidth="4" />
      <path d="M70 160q34-25 64 0m102 9q25-23 49 0" stroke="#F9C4D1" strokeWidth="5" fill="none" />
      <rect x="20" y="92" width="320" height="34" fill="#E985A1" />
      {Array.from({length: 8}, (_, i) => <path key={i}
        d={`M${20 + i * 40} 92h40l-7 42h-26Z`} fill={i % 2 ? "#FFF5EC" : "#EF9DB4"} />)}
      <path d="M20 134q20 16 40 0 20 16 40 0 20 16 40 0 20 16 40 0 20 16 40 0 20 16 40 0 20 16 40 0 20 16 40 0"
        fill="none" stroke="#D57E9C" strokeWidth="3" />
      <rect x="118" y="38" width="124" height="42" rx="20" fill="#FFF9F3" stroke="#C97994" strokeWidth="4" />
      <path d="M166 63l8-16h13l8 16Z" fill="#DEB279" stroke="#9C6B5A" strokeWidth="2" />
      <circle cx="181" cy="48" r="10" fill="#EE91B0" /><circle cx="198" cy="58" r="3" fill="#D95073" />
      <path d="M58 314h244" stroke="#B76E88" strokeWidth="6" strokeLinecap="round" />
      <g fill="#7DA889"><path d="M21 350q-11-38 2-49 15 24 5 49Z" /><path d="M38 352q-2-46 17-55 4 28-10 55Z" />
        <path d="M339 350q11-38-2-49-15 24-5 49Z" /><path d="M322 352q2-46-17-55-4 28 10 55Z" /></g>
      <path d="M12 348h53l-8 34H20Zm283 0h53l-8 34h-37Z" fill="#D7879E" />
    </>}
    {scene === "turkish-stand" && <>
      <rect width="360" height="480" fill="#FCE7CE" />
      <circle cx="285" cy="92" r="43" fill="#F8CD8C" opacity=".8" />
      <path d="M0 333q83-60 172-15t188-10v172H0Z" fill="#EFC6AC" />
      <rect y="390" width="360" height="90" fill="#DBB599" />
      <path d="M0 419h360M35 390v90M135 390v90M235 390v90M335 390v90" stroke="#C8987D" strokeWidth="2" />
      <path d="M33 117h294l-14 75H47Z" fill="#F8EEE2" stroke="#A65A52" strokeWidth="4" />
      {Array.from({length: 7}, (_, i) => <path key={i}
        d={`M${34 + i * 42} 117h42l-7 75h-28Z`} fill={i % 2 ? "#FFF4E6" : "#C96B67"} />)}
      <path d="M47 192q21 18 42 0 21 18 42 0 21 18 42 0 21 18 42 0 21 18 42 0 21 18 56 0"
        fill="none" stroke="#A65A52" strokeWidth="4" />
      <path d="M55 192v166m250-166v166" stroke="#8F5952" strokeWidth="8" strokeLinecap="round" />
      <rect x="60" y="313" width="240" height="58" rx="9" fill="#B97957" stroke="#845344" strokeWidth="5" />
      <rect x="76" y="325" width="208" height="18" rx="4" fill="#DAA47B" />
      <path d="M93 307v-32q17-33 35 0v32Zm70 0v-39q17-35 36 0v39Zm71 0v-32q17-33 35 0v32Z"
        fill="#F8D6A0" stroke="#9F6551" strokeWidth="4" />
      <path d="M91 252h183" stroke="#8F5952" strokeWidth="4" />
      <path d="M110 251v-18m72 18v-24m72 24v-18" stroke="#8F5952" strokeWidth="3" />
      <path d="M104 232q8-10 16 0m54-5q8-10 16 0m56 5q8-10 16 0" fill="none" stroke="#E7AE8A" strokeWidth="5" />
      <path d="M265 89v93m0 0q21 11 26-4" stroke="#805A49" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M70 80h219" stroke="#9E6656" strokeWidth="5" />
      <circle cx="88" cy="81" r="7" fill="#F6D287" /><circle cx="180" cy="81" r="7" fill="#F6D287" />
      <circle cx="272" cy="81" r="7" fill="#F6D287" />
    </>}
    {scene === "evening-street" && <>
      <rect width="360" height="480" fill="#DCD8E7" />
      <circle cx="285" cy="100" r="39" fill="#F9E2B7" />
      <rect x="0" y="150" width="93" height="195" fill="#AFAFC5" />
      <path d="M0 150 47 103l46 47" fill="#B7ADC2" />
      <rect x="267" y="135" width="93" height="210" fill="#BFAFC0" />
      <path d="m267 135 46-54 47 54" fill="#C9BBC8" />
      <rect x="103" y="194" width="50" height="150" fill="#C5B9C8" />
      <rect x="213" y="184" width="43" height="160" fill="#ADAFC5" />
      <g fill="#F7DEB7" stroke="#8B879E" strokeWidth="3">
        <rect x="21" y="198" width="25" height="38" rx="3" /><rect x="54" y="198" width="25" height="38" rx="3" />
        <rect x="21" y="260" width="25" height="38" rx="3" /><rect x="54" y="260" width="25" height="38" rx="3" />
        <rect x="282" y="188" width="25" height="38" rx="3" /><rect x="318" y="188" width="25" height="38" rx="3" />
        <rect x="282" y="254" width="25" height="38" rx="3" /><rect x="318" y="254" width="25" height="38" rx="3" />
      </g>
      <path d="M0 345h360v135H0Z" fill="#ACA8B8" />
      <path d="M142 345 0 480m218-135 142 135M0 390h360M0 444h360" stroke="#CFC7C9" strokeWidth="4" />
      <path d="M142 345h76" stroke="#E7D8CA" strokeWidth="6" />
      <path d="M116 340V129m0 0q0-23 27-23m-27 25h35" stroke="#545363" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M138 131q0 27 13 27t13-27Z" fill="#FFF0C9" stroke="#726979" strokeWidth="3" />
      <path d="M236 337V158m0 0q0-20-20-20m20 22h-30" stroke="#545363" strokeWidth="5" fill="none" />
      <path d="M206 159q0 21-11 21t-11-21Z" fill="#FFF0C9" stroke="#726979" strokeWidth="3" />
      <path d="M43 338q11-26 23 0m236 0q10-26 22 0" stroke="#708C7B" strokeWidth="8" fill="none" />
    </>}
  </svg>;
}
