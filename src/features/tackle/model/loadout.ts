import type { BaitId, ChumId, GameDocument, StockId } from "../../../shared/types";
import { clamp } from "../../../shared/random";

export function chooseHook(doc: GameDocument, id: BaitId): GameDocument {
  return doc.stock[id] > 0 ? { ...doc, hook: id } : doc;
}

export function chooseChum(doc: GameDocument, id: ChumId | null): GameDocument {
  if (id === null) return { ...doc, chum: null };
  return doc.stock[id] > 0 ? { ...doc, chum: id } : doc;
}

export function tune(doc: GameDocument, key: "power" | "drag", value: number) {
  return { ...doc, [key]: clamp(value, 0.15, 0.95) };
}

export interface LoadoutCheck {
  ok: boolean;
  missing: StockId[];
  cost: Partial<Record<StockId, number>>;
}

/**
 * The whole rig is deducted together. A cast is only valid when every chosen
 * item — the hook bait and the optional chum — is in stock. If anything is
 * missing, nothing at all is deducted.
 */
export function checkLoadout(doc: GameDocument): LoadoutCheck {
  const cost: Partial<Record<StockId, number>> = { [doc.hook]: 1 };
  if (doc.chum) cost[doc.chum] = 1;
  const missing = (Object.keys(cost) as StockId[]).filter(
    (id) => doc.stock[id] < (cost[id] ?? 0),
  );
  return { ok: missing.length === 0, missing, cost };
}

export function consumeLoadout(doc: GameDocument): GameDocument | null {
  const check = checkLoadout(doc);
  if (!check.ok) return null;
  const stock = { ...doc.stock };
  for (const id of Object.keys(check.cost) as StockId[])
    stock[id] -= check.cost[id] ?? 0;
  return { ...doc, stock };
}

export function resupply(doc: GameDocument): GameDocument {
  return {
    ...doc,
    stock: { worm: 24, corn: 20, fly: 16, rice: 18, shrimp: 14, bran: 16 },
  };
}
