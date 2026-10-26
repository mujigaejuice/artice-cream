/** Code-owned assets; database rows only store stable keys. */
export const COSMETIC_ASSETS = {
  "berry-palette": "palette",
  "cocoa-cone": "cone",
  "sugar-stars": "topping",
  "night-sky": "background",
  "one-scoop-of-joy": "music",
  "tiptoe-into-sunlight": "music",
  "two-scoops-of-july": "music",
  "waffle-cone-waltz": "music",
} as const;

export type CosmeticSlot = "palette" | "cone" | "topping" | "background" | "music";
export type Equipped = Partial<Record<CosmeticSlot, string>>;
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
