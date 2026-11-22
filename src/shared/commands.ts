import type { BaitId, ChumId, SpotId } from "./types";
export type Command =
  | { type: "spot"; id: SpotId }
  | { type: "hook"; id: BaitId }
  | { type: "chum"; id: ChumId | null }
  | { type: "power"; value: number }
  | { type: "drag"; value: number }
  | { type: "charge-start" }
  | { type: "charge-cancel" }
  | { type: "cast" }
  | { type: "strike" }
  | { type: "reel"; held: boolean }
  | { type: "tick"; dt: number }
  | { type: "next" }
  | { type: "release"; id: string }
  | { type: "claim"; id: string }
  | { type: "resupply" }
  | { type: "clear-field" };
