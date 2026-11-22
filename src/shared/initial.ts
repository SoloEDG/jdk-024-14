import type { GameDocument, Session } from "./types";
import { defaultZone } from "../features/scent/model/zones";
export function newDocument(): GameDocument {
  const spot = "reed";
  return {
    version: 2,
    spot,
    hook: "worm",
    chum: "rice",
    power: 0.6,
    drag: 0.4,
    seed: 48127,
    stock: { worm: 24, corn: 20, fly: 16, rice: 18, shrimp: 14, bran: 16 },
    clock: 0,
    chumField: [],
    lastDrop: null,
    bag: [],
    journal: {},
    stats: { casts: 0, catches: 0, escapes: 0, released: 0 },
    claimed: [],
  };
}
export function idleSession(): Session {
  return {
    id: "",
    phase: "ready",
    clock: 0,
    charge: 0,
    castPower: 0,
    spot: "reed",
    hook: "worm",
    chum: "rice",
    zone: defaultZone("reed"),
    startedAt: 0,
    fish: null,
    weight: 0,
    progress: 0,
    tension: 0.35,
    energy: 1,
    slackTime: 0,
    overload: 0,
    peak: 0,
    reeling: false,
    duration: 0,
    message: "深呼吸，把时间交给湖面。",
    fishRoll: 0,
    sizeRoll: 0,
    exposure: {},
    biteScent: null,
    combo: null,
  };
}
export function isBusy(s: Session) {
  return ["charging", "waiting", "bite", "fighting"].includes(s.phase);
}
