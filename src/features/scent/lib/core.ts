import type {
  BaitId,
  ChumPortion,
  ComponentRanges,
  ComboPart,
  ComboSnapshot,
  FieldGroup,
  FishId,
  FishScentRead,
  GameDocument,
  InteractionEffect,
  ScentComponent,
  ScentProfile,
  ScentRange,
  ScentReport,
  ScentSource,
  ScentTier,
  SpotId,
} from "../../../shared/types";
import { species } from "../../../shared/catalog";
import {
  chumInfo,
  componentOrder,
  hookBaitInfo,
} from "../model/materials";
import { diffusion, transmission, zoneName } from "../model/zones";

/** Scores at or above this value count as attracting the fish. */
export const ATTRACT_THRESHOLD = 0.4;
/** Scores at or below this value count as repelling the fish. */
export const REPEL_THRESHOLD = -0.28;

/** Measurement uncertainty carried even without any merging. */
export const INTRINSIC_ERROR = 0.03;
/** Two portions merge only when their remaining life is within this band. */
export const LIFE_MERGE_TOLERANCE = 0.12;
/** Release rates must match to this precision before portions can merge. */
export const RATE_MERGE_TOLERANCE = 0.005;

export interface ScentHook {
  bait: BaitId;
  zone: string;
  bornAt: number;
}

export interface ReportOptions {
  /** Widen readings by the approximation error of merged field groups. */
  merge?: boolean;
  hook?: ScentHook;
}

interface Rule {
  pair: [ScentComponent, ScentComponent];
  kind: "synergy" | "conflict";
  name: string;
  coeff: number;
}

/**
 * Co-presence rules. A synergy adds scent where the two components actually
 * meet in time; a conflict masks both components. Components that merely pass
 * through the same water at different times never interact.
 */
export const interactionRules: Rule[] = [
  {
    pair: ["savory", "ferment"],
    kind: "synergy",
    name: "腥酵复合香",
    coeff: 0.2,
  },
  {
    pair: ["sweet", "ferment"],
    kind: "synergy",
    name: "甜酵熟香",
    coeff: 0.16,
  },
  {
    pair: ["savory", "sweet"],
    kind: "conflict",
    name: "腥甜相冲",
    coeff: -0.14,
  },
];

/** Amounts are in "portion units"; the model rounds them for display only. */
export function upperProfile(p: ScentProfile, scale = 1): ComponentRanges {
  return {
    savory: { low: p.savory * scale, high: p.savory * scale },
    sweet: { low: p.sweet * scale, high: p.sweet * scale },
    ferment: { low: p.ferment * scale, high: p.ferment * scale },
  };
}

/** Build a profile whose reading keeps a small honest error band. */
export function rangedProfile(
  p: ScentProfile,
  scale = 1,
  error = INTRINSIC_ERROR,
): ComponentRanges {
  const low = upperProfile(p, scale * (1 - error));
  const high = upperProfile(p, scale * (1 + error));
  return {
    savory: { low: low.savory.low, high: high.savory.high },
    sweet: { low: low.sweet.low, high: high.sweet.high },
    ferment: { low: low.ferment.low, high: high.ferment.high },
  };
}

export function zeroRanges(): ComponentRanges {
  return {
    savory: { low: 0, high: 0 },
    sweet: { low: 0, high: 0 },
    ferment: { low: 0, high: 0 },
  };
}

export function cloneRanges(r: ComponentRanges): ComponentRanges {
  return {
    savory: { ...r.savory },
    sweet: { ...r.sweet },
    ferment: { ...r.ferment },
  };
}

export function rangeMid(r: ScentRange) {
  return (r.low + r.high) / 2;
}

export function midProfile(r: ComponentRanges): ScentProfile {
  return {
    savory: rangeMid(r.savory),
    sweet: rangeMid(r.sweet),
    ferment: rangeMid(r.ferment),
  };
}

export function totalAmount(r: ComponentRanges) {
  return componentOrder.reduce((n, c) => n + Math.max(0, r[c].low), 0);
}

export function sumRanges(values: ScentRange[]): ScentRange {
  return values.reduce(
    (a, v) => ({ low: a.low + v.low, high: a.high + v.high }),
    { low: 0, high: 0 },
  );
}

export function tierOf(range: ScentRange): ScentTier {
  const spansAttract =
    range.low < ATTRACT_THRESHOLD && range.high > ATTRACT_THRESHOLD;
  const spansRepel =
    range.low < REPEL_THRESHOLD && range.high > REPEL_THRESHOLD;
  if (spansAttract || spansRepel) return "uncertain";
  if (range.low >= ATTRACT_THRESHOLD) return "attract";
  if (range.high <= REPEL_THRESHOLD) return "repel";
  return "neutral";
}

export function tierLabel(tier: ScentTier) {
  return tier === "attract"
    ? "吸引"
    : tier === "repel"
      ? "排斥"
      : tier === "uncertain"
        ? "不确定"
        : "中性";
}

/** Remaining share of a deposit's mass, 0 once it has fully broken down. */
export function remainingRatio(portion: ChumPortion, at: number) {
  if (at <= portion.bornAt) return 1;
  const elapsed = at - portion.bornAt;
  if (elapsed >= portion.lifespan) return 0;
  return 1 - elapsed / portion.lifespan;
}

function portionComponentsAt(
  portion: ChumPortion,
  spot: SpotId,
  zone: string,
  at: number,
): ComponentRanges {
  const ratio = remainingRatio(portion, at);
  const trans = transmission(spot, portion.zone, zone);
  const scent = chumInfo[portion.chum].scent;
  const scale = ratio * portion.releaseRate * trans;
  return rangedProfile(scent, scale);
}

function windowOf(source: ScentSource, at: number): [number, number] {
  const start = source.bornAt ?? at;
  if (source.kind === "hook") return [start, at];
  return [start, start + (source.lifespan ?? 0)];
}

/**
 * Fraction of the shorter emission window that two sources share. Portions
 * that never overlapped in time score 0 here, so sequential casts are never
 * treated as one simultaneous mixture.
 */
function overlapFactor(a: ScentSource, b: ScentSource, at: number) {
  const [a0, a1] = windowOf(a, at);
  const [b0, b1] = windowOf(b, at);
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const shorter = Math.min(a1 - a0, b1 - b0);
  if (shorter <= 0) return 0;
  return Math.min(1, overlap / shorter);
}

/**

 * When scent from a foreign zone first reaches the measured zone. Diffusion
 * takes time, so a cloud that has only just been laid elsewhere is not felt
 * on this side of the water yet.
 */
function arrivalDelay(spot: SpotId, from: string, to: string) {
  if (from === to) return 0;
  return diffusion(spot) * 0.08;
}

function buildSources(
  doc: GameDocument,
  spot: SpotId,
  zone: string,
  at: number,
  hook: ScentHook | undefined,
): ScentSource[] {
  const sources: ScentSource[] = [];
  for (const portion of doc.chumField) {
    if (portion.spot !== spot) continue;
    const trans = transmission(spot, portion.zone, zone);
    if (trans <= 0) continue;
    const ratio = remainingRatio(portion, at);
    if (ratio <= 0) continue;
    if (at - portion.bornAt < arrivalDelay(spot, portion.zone, zone)) continue;
    sources.push({
      id: portion.id,
      kind: "chum",
      label: chumInfo[portion.chum].name,
      chum: portion.chum,
      hook: null,
      spot,
      zone: portion.zone,
      zoneName: zoneName(spot, portion.zone),
      castNumber: portion.castNumber,
      bornAt: portion.bornAt,
      age: Math.max(0, at - portion.bornAt),
      lifespan: portion.lifespan,
      remaining: portion.initial * ratio,
      remainingRatio: ratio,
      releaseRate: portion.releaseRate,
      transmission: trans,
      hops: portion.zone === zone ? 0 : 1,
      components: portionComponentsAt(portion, spot, zone, at),
    });
  }
  if (hook) {
    const info = hookBaitInfo[hook.bait];
    const scale = info.coating * transmission(spot, hook.zone, zone);
    const arrived = at - hook.bornAt >= arrivalDelay(spot, hook.zone, zone);
    if (scale > 0 && arrived) {
      sources.push({
        id: `hook-${hook.bait}`,
        kind: "hook",
        label: info.name,
        chum: null,
        hook: hook.bait,
        spot,
        zone: hook.zone,
        zoneName: zoneName(spot, hook.zone),
        castNumber: null,
        bornAt: hook.bornAt,
        age: Math.max(0, at - hook.bornAt),
        lifespan: null,
        remaining: 1,
        remainingRatio: 1,
        releaseRate: 1,
        transmission: scale,
        hops: hook.zone === zone ? 0 : 1,
        components: rangedProfile(info.scent, scale),
      });
    }
  }
  return sources;
}

function buildGroups(
  spot: SpotId,
  sources: ScentSource[],
): { groups: FieldGroup[]; error: ComponentRanges; errorRatio: number } {
  const chumSources = sources.filter((s) => s.kind === "chum");
  const buckets = new Map<string, ScentSource[]>();
  for (const source of chumSources) {
    const rateSlots = Math.round(source.releaseRate / RATE_MERGE_TOLERANCE);
    const key = `${source.zone}|${source.chum}|${rateSlots}`;
    const list = buckets.get(key) ?? [];
    list.push(source);
    buckets.set(key, list);
  }

  const groups: FieldGroup[] = [];
  const error = zeroRanges();
  let index = 0;
  for (const [key, list] of buckets) {
    const [groupZone, chum] = key.split("|") as [string, string];
    const sorted = [...list].sort(
      (a, b) => a.remainingRatio - b.remainingRatio,
    );
    const clusters: ScentSource[][] = [];
    for (const source of sorted) {
      const last = clusters[clusters.length - 1];
      // Anchor on the cluster's first (freshest) member so a long chain of
      // staggered casts cannot creep far outside the life tolerance.
      const anchor = last?.[0];
      if (
        last &&
        anchor &&
        Math.abs(source.remainingRatio - anchor.remainingRatio) <=
          LIFE_MERGE_TOLERANCE
      )
        last.push(source);
      else clusters.push([source]);
    }
    for (const cluster of clusters) {
      const components = zeroRanges();
      for (const source of cluster)
        for (const c of componentOrder) {
          components[c].low += source.components[c].low;
          components[c].high += source.components[c].high;
        }
      const ratios = cluster.map((s) => s.remainingRatio);
      const spread = Math.max(...ratios) - Math.min(...ratios);
      const mergeError =
        cluster.length > 1 ? Math.min(0.18, spread * 0.6 + 0.02) : 0;
      if (cluster.length > 1)
        for (const c of componentOrder) {
          const amount = components[c].low * mergeError;
          error[c].low += amount;
          error[c].high += amount;
        }
      groups.push({
        id: `field-${index++}`,
        chum: chum as NonNullable<GameDocument["chum"]>,
        zone: groupZone,
        zoneName: zoneName(spot, groupZone),
        spot,
        portionIds: cluster.map((s) => s.id),
        count: cluster.length,
        remaining: cluster.reduce((n, s) => n + s.remaining, 0),
        remainingRatio:
          cluster.reduce((n, s) => n + s.remainingRatio, 0) / cluster.length,
        releaseRate: cluster[0].releaseRate,
        components,
        merged: cluster.length > 1,
        mergeError,
        note: null,
      });
    }
  }

  // Explain why neighbouring same-recipe portions stayed separate.
  for (const group of groups) {
    const sameZone = groups.filter(
      (g) => g.id !== group.id && g.zone === group.zone && g.chum === group.chum,
    );
    const lifeSplit = sameZone.some(
      (g) => Math.abs(g.releaseRate - group.releaseRate) < RATE_MERGE_TOLERANCE,
    );
    const rateSplit = sameZone.some(
      (g) => Math.abs(g.releaseRate - group.releaseRate) >= RATE_MERGE_TOLERANCE,
    );
    if (rateSplit) group.note = "释放速度不同 · 分列";
    else if (lifeSplit) group.note = "剩余寿命不同 · 分列";
  }
  for (const group of groups) {
    const cut = chumSources.find(
      (s) =>
        s.zone !== group.zone &&
        s.chum === group.chum &&
        Math.abs(s.remainingRatio - group.remainingRatio) < 0.05,
    );
    if (cut && !group.note) group.note = "隔岸/异区 · 不合并";
  }

  let amountTotal = 0;
  let errorTotal = 0;
  for (const c of componentOrder) {
    amountTotal +=
      chumSources.reduce((n, s) => n + s.components[c].high, 0);
    errorTotal += error[c].high;
  }
  const errorRatio = amountTotal > 0 ? errorTotal / amountTotal : 0;
  return { groups, error, errorRatio };
}

function buildInteractions(sources: ScentSource[], at: number) {
  const interactions: InteractionEffect[] = [];
  const delta = zeroRanges();
  for (const rule of interactionRules) {
    const [a, b] = rule.pair;
    const componentTotal = sources.reduce(
      (n, s) => n + s.components[a].low + s.components[b].low,
      0,
    );
    if (componentTotal < 0.02) continue;
    let mixed = 0;
    for (let i = 0; i < sources.length; i++) {
      const si = sources[i];
      for (let j = i; j < sources.length; j++) {
        const sj = sources[j];
        const overlap = i === j ? 1 : overlapFactor(si, sj, at);
        if (overlap <= 0) continue;
        const aInI = si.components[a].low;
        const bInI = si.components[b].low;
        const aInJ = sj.components[a].low;
        const bInJ = sj.components[b].low;
        mixed +=
          i === j
            ? Math.min(aInI, bInI)
            : (Math.min(aInI, bInJ) + Math.min(aInJ, bInI)) * overlap;
      }
    }
    if (mixed < 0.02) continue;
    const amount = rule.coeff * mixed;
    const signed = { low: amount, high: amount };
    delta[a].low += signed.low;
    delta[a].high += signed.high;
    delta[b].low += signed.low;
    delta[b].high += signed.high;
    const first = sources.find((s) => s.components[a].low > 0);
    const second = sources.find((s) => s.components[b].low > 0);
    interactions.push({
      pair: rule.pair,
      kind: rule.kind,
      name: rule.name,
      amount: signed,
      between: [first?.id ?? "-", second?.id ?? "-"],
    });
  }
  return { interactions, delta };
}

export interface BuiltReport extends ScentReport {
  mergeError: ComponentRanges;
}

export function buildReport(
  doc: GameDocument,
  spot: SpotId,
  zone: string,
  at: number,
  options: ReportOptions = {},
): BuiltReport {
  const sources = buildSources(doc, spot, zone, at, options.hook);
  const raw = zeroRanges();
  for (const source of sources)
    for (const c of componentOrder) {
      raw[c].low += source.components[c].low;
      raw[c].high += source.components[c].high;
    }
  const { groups, error: mergeError, errorRatio } = buildGroups(spot, sources);
  const { interactions, delta } = buildInteractions(sources, at);
  const components = zeroRanges();
  const widen = options.merge === true;
  for (const c of componentOrder) {
    const extra = widen ? mergeError[c].low : 0;
    components[c] = {
      low: Math.max(0, raw[c].low + delta[c].low - extra),
      high: Math.max(0, raw[c].high + delta[c].high + extra),
    };
  }
  return {
    spot,
    zone,
    zoneName: zoneName(spot, zone),
    at,
    components,
    raw,
    interactionDelta: delta,
    sources,
    groups,
    interactions,
    chumSourceCount: sources.filter((s) => s.kind === "chum").length,
    errorRatio,
    hookIncluded: sources.some((s) => s.kind === "hook"),
    mergeError,
  };
}

function weighted(w: number, r: ScentRange): ScentRange {
  return w >= 0
    ? { low: w * r.low, high: w * r.high }
    : { low: w * r.high, high: w * r.low };
}

/**
 * Hook entry preference. The bait on the hook changes how willing a fish is
 * to take it, independent of the chum cloud. It only appears while a hook is
 * actually in the water.
 */
export function entryPreference(fish: FishId, hook: BaitId): ScentRange {
  const f = species(fish);
  const preferred = f.baits.indexOf(hook);
  const base = preferred >= 0 ? 0.34 - preferred * 0.06 : -0.22;
  const info = hookBaitInfo[hook];
  const echo =
    (f.scent.savory * info.scent.savory +
      f.scent.sweet * info.scent.sweet +
      f.scent.ferment * info.scent.ferment) *
    0.12;
  const value = base + echo;
  return { low: value * 0.92, high: value * 1.08 };
}

export function readFish(report: BuiltReport, fish: FishId): FishScentRead {
  const w = species(fish).scent;
  const contribution = zeroRanges();
  const rawContribution = zeroRanges();
  for (const c of componentOrder) {
    contribution[c] = weighted(w[c], report.components[c]);
    rawContribution[c] = weighted(w[c], report.raw[c]);
  }
  const hookSource = report.sources.find((s) => s.kind === "hook");
  const entry: ScentRange = hookSource?.hook
    ? entryPreference(fish, hookSource.hook)
    : { low: 0, high: 0 };
  const score = sumRanges([
    ...componentOrder.map((c) => contribution[c]),
    entry,
  ]);
  return {
    fish,
    score,
    contribution,
    rawContribution,
    entry,
    tier: tierOf(score),
  };
}

/** Local scent concentration used for the fish's sustained contact. */
export function scentIntensity(report: BuiltReport) {
  return totalAmount(report.components);
}

export function comboFromReport(
  report: BuiltReport,
  fish: FishId,
  hook: BaitId,
  castId: string,
): ComboSnapshot {
  const chumSources = report.sources.filter((s) => s.kind === "chum");
  const parts: ComboPart[] = chumSources.map((s) => ({
    portionId: s.id,
    chum: s.chum as NonNullable<ScentSource["chum"]>,
    castNumber: s.castNumber ?? 0,
    zone: s.zone,
    zoneName: s.zoneName,
    bornAt: s.bornAt ?? 0,
    age: s.age,
    remaining: s.remaining,
    remainingRatio: s.remainingRatio,
    components: s.components,
  }));
  const chums = [...new Set(parts.map((p) => p.chum))];
  const castNumbers = [...new Set(parts.map((p) => p.castNumber))];
  const layered = castNumbers.length > 1;
  const origins = new Set(parts.map((p) => p.zone));
  const baseLabel =
    (parts.length > 0 ? chums.map((c) => chumInfo[c].short).join(" + ") : "无诱窝") +
    " · " +
    hookBaitInfo[hook].short;
  const label =
    baseLabel +
    (origins.size > 1
      ? `（${origins.size} 区汇入${layered ? "·叠竿" : ""}）`
      : "");
  const key = [
    hook,
    ...chums.sort(),
    layered ? `layers:${castNumbers.length}` : "single",
  ].join("|");
  const read = readFish(report, fish);
  return {
    key,
    label,
    hook,
    chum: chums.length === 1 ? chums[0] : null,
    chums,
    parts,
    tier: read.tier,
    components: report.components,
    at: report.at,
    castId,
    layered,
    effects: report.interactions.map((e) => ({
      kind: e.kind,
      name: e.name,
    })),
  };
}

export function comboLabel(combo: ComboSnapshot | undefined) {
  return combo?.label ?? "旧单饵";
}
