/** Code-owned assets; database rows only store stable keys. */
export const COSMETIC_ASSETS = {
  "berry-palette": "palette",
  "cocoa-cone": "cone",
  "sugar-stars": "topping",
  "rainbow-sprinkles": "topping",
  "chocolate-drizzle": "topping",
  "cheese-cubes": "topping",
  "fresh-strawberry": "topping",
  "night-sky": "background",
  "pink-parlor": "background",
  "turkish-stand": "background",
  "evening-street": "background",
  "cloud-swirl": "texture",
  "gelato-folds": "texture",
  "one-scoop-of-joy": "music",
  "tiptoe-into-sunlight": "music",
  "two-scoops-of-july": "music",
  "waffle-cone-waltz": "music",
} as const;

export type CosmeticSlot = "palette" | "cone" | "topping" | "background" | "texture" | "music";
export type Equipped = Partial<Record<CosmeticSlot, string>>;
export type ScoopColors = Partial<Record<"cloud" | "infra" | "data" | "cs-fundamentals" |
  "deep-learning" | "llm" | "ai-security" | "security", string>>;

const domains = new Set(["cloud", "infra", "data", "cs-fundamentals", "deep-learning",
  "llm", "ai-security", "security"]);

export function safeScoopColors(value: unknown): ScoopColors {
  const safe: ScoopColors = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return safe;
  for (const [domain, color] of Object.entries(value)) {
    if (domains.has(domain) && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
      safe[domain as keyof ScoopColors] = color.toUpperCase();
    }
  }
  return safe;
}
export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  nameKo: string;
  price: number;
  assetKey: string;
  catalogVersion: number;
  isActive: boolean;
  owned: boolean;
};
export type ShopSnapshot = {
  userId: string;
  balance: number;
  spendableBalance: number;
  spendingEnabled: boolean;
  items: CosmeticItem[];
  ownedItems: string[];
  equipped: Equipped;
  scoopColors?: ScoopColors;
};

export const OPEN_SHOP_EVENT = "artice:open-shop";

export function safeEquipped(equipped: Equipped | null | undefined): Equipped {
  const safe: Equipped = {};
  if (!equipped) return safe;
  for (const [slot, key] of Object.entries(equipped)) {
    if (typeof key === "string" && COSMETIC_ASSETS[key as keyof typeof COSMETIC_ASSETS] === slot) {
      safe[slot as CosmeticSlot] = key;
    }
  }
  return safe;
}
