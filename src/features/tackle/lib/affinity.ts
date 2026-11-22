import { fishCatalog } from "../../../shared/catalog";
import type { BaitId, SpotId } from "../../../shared/types";

/**
 * Which fish each hook bait tends to favour in a given water. This is only
 * the quick "入口偏好" preview; the real outcome also depends on the chum
 * field (see features/scent/lib/core).
 */
export function attraction(spot: SpotId, bait: BaitId) {
  return fishCatalog
    .filter((f) => f.waters.includes(spot))
    .map((f) => ({
      fish: f,
      weight:
        (f.baits.includes(bait) ? 5 : 1) *
        (f.rarity === "稀有" ? 0.45 : f.rarity === "少见" ? 0.7 : 1),
    }));
}
