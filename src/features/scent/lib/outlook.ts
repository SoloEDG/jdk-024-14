import type {
  BaitId,
  ComponentRanges,
  FishId,
  FishScentRead,
  GameDocument,
  ScentTier,
} from "../../../shared/types";
import {
  ATTRACT_THRESHOLD,
  REPEL_THRESHOLD,
  buildReport,
  readFish,
  tierLabel,
  type BuiltReport,
} from "../lib/core";
import { componentInfo, componentOrder } from "../model/materials";
import { fmtRange, fmtSigned } from "../lib/display";

/** Range-safe fish read for a given water, zone, hook and stock field. */
export interface FishOutlook {
  fish: FishId;
  read: FishScentRead;
  tier: ScentTier;
  label: string;
}

export function fishOutlookFrom(
  report: BuiltReport,
  fishes: FishId[],
): FishOutlook[] {
  return fishes.map((fish) => {
    const read = readFish(report, fish);
    return { fish, read, tier: read.tier, label: tierLabel(read.tier) };
  });
}

export function previewReport(
  doc: GameDocument,
  zone: string,
  hook: BaitId,
  merge = true,
): BuiltReport {
  return buildReport(doc, doc.spot, zone, doc.clock, {
    hook: { bait: hook, zone, bornAt: doc.clock },
    merge,
  });
}

export function scoreBar(read: FishScentRead) {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const lo = clamp(read.score.low);
  const hi = clamp(read.score.high);
  return {
    left: ((lo + 1) / 2) * 100,
    width: Math.max(0.8, ((hi - lo) / 2) * 100),
    attractAt: ((ATTRACT_THRESHOLD + 1) / 2) * 100,
    repelAt: ((REPEL_THRESHOLD + 1) / 2) * 100,
    crosses: (read.score.low < ATTRACT_THRESHOLD && read.score.high > ATTRACT_THRESHOLD) ||
      (read.score.low < REPEL_THRESHOLD && read.score.high > REPEL_THRESHOLD),
  };
}

export function contributionRows(ranges: ComponentRanges) {
  const total = componentOrder.reduce(
    (n, c) => n + Math.abs((ranges[c].low + ranges[c].high) / 2),
    0,
  );
  return componentOrder.map((c) => {
    const mid = (ranges[c].low + ranges[c].high) / 2;
    return {
      ...componentInfo[c],
      text: fmtSigned(ranges[c]),
      width: total > 0 ? (Math.abs(mid) / total) * 100 : 0,
      negative: mid < 0,
      range: fmtRange(ranges[c]),
    };
  });
}
