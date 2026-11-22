import type {
  BaitId,
  FishId,
  BiteScentReport,
  ChumId,
  ChumPortion,
  GameDocument,
  Session,
} from "../../../shared/types";
import { random } from "../../../shared/random";
import { idleSession } from "../../../shared/initial";
import { fishCatalog, species } from "../../../shared/catalog";
import {
  ATTRACT_THRESHOLD,
  buildReport,
  comboFromReport,
  readFish,
  tierOf,
} from "../../scent/lib/core";
import { dropZone, releaseVigor, zoneName } from "../../scent/model/zones";
import { chumInfo } from "../../scent/model/materials";

/** Water contact (concentration-seconds) needed by an average fish. */
export const NEED_BASE = 9;
/** No bite after this many game seconds means the scent never worked. */
export const PATIENCE = 42;

export function hookNeedFactor(hook: BaitId, fish: FishId) {
  return species(fish).baits.includes(hook) ? 0.74 : 1.18;
}

export function makePortion(
  doc: GameDocument,
  zone: string,
  chum: ChumId,
  hook: BaitId,
  at: number,
): ChumPortion {
  const info = chumInfo[chum];
  const castNumber = doc.stats.casts + 1;
  // Release speed follows the local current. Portions in different currents
  // can read the same concentration while breaking down at different speeds,
  // which keeps them in separate field groups.
  const vigor = releaseVigor(doc.spot, zone);
  return {
    id: `chum-${doc.spot}-${castNumber}`,
    castId: `cast-${castNumber}`,
    castNumber,
    spot: doc.spot,
    zone,
    chum,
    hook,
    bornAt: at,
    lifespan: info.lifespan,
    releaseRate: Math.round(info.releaseRate * vigor * 1000) / 1000,
    vigor,
    initial: info.portion * vigor,
  };
}

export interface PreparedCast {
  session: Session;
  seed: number;
  portion: ChumPortion | null;
}

export function needFor(fish: FishId, hook: BaitId, salt: number) {
  const base = NEED_BASE * hookNeedFactor(hook, fish);
  return base * (0.9 + salt * 0.35);
}

export function prepareCast(
  doc: GameDocument,
  charge: number,
  hook: BaitId,
  chum: ChumId | null,
  at: number,
): PreparedCast {
  const [roll, s1] = random(doc.seed);
  const [size, s2] = random(s1);
  const [, seed] = random(s2);
  const castNumber = doc.stats.casts + 1;
  const zone = dropZone(doc.spot, charge);
  const portion = chum
    ? makePortion(doc, zone, chum, hook, at)
    : null;

  return {
    seed,
    portion,
    session: {
      ...idleSession(),
      id: `${seed}-${castNumber}`,
      phase: "waiting",
      spot: doc.spot,
      hook,
      chum,
      zone,
      startedAt: at,
      castPower: charge,
      fish: null,
      weight: 0,
      message: `浮漂落在${zoneName(doc.spot, zone)}，让窝味慢慢散开。`,
      fishRoll: roll,
      sizeRoll: size,
      exposure: {},
    },
  };
}

export function candidatesAt(spot: GameDocument["spot"]) {
  return fishCatalog.filter((f) => f.waters.includes(spot));
}

export interface WaitingResult {
  session: Session;
  /** Fish that just committed, if any. */
  biter: string | null;
  timedOut: boolean;
}

/**
 * Advance scent contact. Every fish that can actually smell the hook adds
 * score × dt to its own exposure budget. A fish commits only while it is in
 * the attracting band and its sustained exposure clears its own need. Brief
 * concentration spikes therefore cannot substitute for a long soak.
 */
export function advanceWaiting(
  s: Session,
  doc: GameDocument,
  at: number,
  dt: number,
): WaitingResult {
  const report = buildReport(doc, s.spot, s.zone, at, {
    hook: { bait: s.hook, zone: s.zone, bornAt: s.startedAt },
  });
  const elapsed = at - s.startedAt;
  const exposure = { ...s.exposure };
  let biter: { fish: FishId; margin: number } | null = null;

  for (const fish of candidatesAt(s.spot)) {
    const read = readFish(report, fish.id);
    // A fish only starts closing in when even its optimistic bias still clears
    // the attraction threshold. Near-threshold uncertainty is reported in the
    // field view, but it does not let a repelled fish commit.
    if (read.score.high < ATTRACT_THRESHOLD) continue;
    const marginal = Math.max(0, (read.score.low + read.score.high) / 2);
    if (marginal <= 0) continue;
    const gained = (exposure[fish.id] ?? 0) + marginal * dt;
    exposure[fish.id] = gained;
    const salt = hash01(`${s.id}:${fish.id}`);
    const need = needFor(fish.id, s.hook, salt);
    const margin = gained - need;
    if (margin >= 0 && (!biter || margin > biter.margin))
      biter = { fish: fish.id, margin };
  }

  if (biter)
    return { session: { ...s, exposure }, biter: biter.fish, timedOut: false };
  if (elapsed >= PATIENCE)
    return {
      session: {
        ...s,
        exposure,
        phase: "escaped",
        message: "窝味始终没能聚住鱼，换个组合或换处窝点再试。",
      },
      biter: null,
      timedOut: true,
    };
  return {
    session: {
      ...s,
      exposure,
      message:
        report.chumSourceCount > 0
          ? `窝味在${zoneName(s.spot, s.zone)}扩散，等待鱼群靠近。`
          : "钩饵的气味有限，补一窝也许更有把握。",
    },
    biter: null,
    timedOut: false,
  };
}

export function freezeBite(
  s: Session,
  doc: GameDocument,
  at: number,
  fish: FishId,
): Session {
  // The stored report widens readings by the merged-field approximation error
  // so a threshold-crossing range is still reported as uncertain. The bite
  // decision above used the precise per-portion reading.
  const report = buildReport(doc, s.spot, s.zone, at, {
    hook: { bait: s.hook, zone: s.zone, bornAt: s.startedAt },
    merge: true,
  });
  const read = readFish(report, fish);
  const salt = hash01(`${s.id}:${fish}`);
  const biteScent: BiteScentReport = {
    ...report,
    fish,
    read,
    contact: s.exposure[fish] ?? 0,
    exposure: s.exposure[fish] ?? 0,
    need: needFor(fish, s.hook, salt),
    tier: tierOf(read.score),
  };
  const combo = comboFromReport(report, fish, s.hook, s.id);
  const sizeBias = 0.2 + hash01(`${s.id}:size`) * 0.7;
  const roll = Math.min(0.99, s.sizeRoll * 0.5 + sizeBias * 0.5);
  return {
    ...s,
    phase: "bite",
    fish,
    sizeRoll: roll,
    weight: sizeWeight(fish, roll),
    biteScent,
    combo,
    message: "有鱼咬钩！点击「提竿」抓住时机。",
  };
}

/** Fold the determined size into the landed weight. */
export function sizeWeight(fish: FishId, roll: number) {
  const f = species(fish);
  return Math.round((f.min + (f.max - f.min) * Math.min(1, roll)) * 100) / 100;
}

function hash01(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function hookIsAvailable(doc: GameDocument, hook: BaitId) {
  return doc.stock[hook] > 0;
}
