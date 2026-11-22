import type {
  Catch,
  GameDocument,
  JournalCombo,
  JournalEntry,
  FishId,
} from "../../../shared/types";
import { comboLabel } from "../../scent/lib/core";

export function recordCatch(
  journal: Partial<Record<FishId, JournalEntry>>,
  catchItem: Catch,
) {
  const old = journal[catchItem.fish];
  const combos = { ...(old?.combos ?? {}) };
  const key = catchItem.combo?.key;
  if (key) {
    const prior: JournalCombo | undefined = combos[key];
    combos[key] = {
      count: (prior?.count ?? 0) + 1,
      label: comboLabel(catchItem.combo),
      layered: catchItem.combo?.layered ?? false,
    };
  } else {
    // Legacy single-bait catch: still explainable from its hook bait alone.
    const legacyKey = `legacy:${catchItem.bait}`;
    const prior: JournalCombo | undefined = combos[legacyKey];
    combos[legacyKey] = {
      count: (prior?.count ?? 0) + 1,
      label: "旧单饵",
      layered: false,
    };
  }
  return {
    ...journal,
    [catchItem.fish]: {
      count: (old?.count ?? 0) + 1,
      best: Math.max(old?.best ?? 0, catchItem.weight),
      first: old?.first ?? catchItem.time,
      combos,
    },
  };
}

export function bagWeight(bag: Catch[]) {
  return bag.reduce((n, c) => n + c.weight, 0);
}

export function comboBreakdown(entry: JournalEntry | undefined) {
  return Object.entries(entry?.combos ?? {}).sort(
    (a, b) => b[1].count - a[1].count,
  );
}

/** Distinct combinations that actually produced a catch. */
export function learnedCombos(journal: GameDocument["journal"]) {
  const keys = new Set<string>();
  for (const entry of Object.values(journal))
    for (const key of Object.keys(entry?.combos ?? {})) keys.add(key);
  return keys.size;
}

/** Combos that mixed chum from more than one cast at the moment of the take. */
export function layeredCombos(journal: GameDocument["journal"]) {
  let n = 0;
  for (const entry of Object.values(journal))
    for (const combo of Object.values(entry?.combos ?? {}))
      if (combo.layered) n++;
  return n;
}
