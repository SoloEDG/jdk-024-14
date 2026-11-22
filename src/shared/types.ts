export type SpotId = "reed" | "brook" | "deep";
export type BaitId = "worm" | "corn" | "fly";
export type ChumId = "rice" | "shrimp" | "bran";
export type ScentComponent = "savory" | "sweet" | "ferment";
export type ScentTier = "attract" | "repel" | "neutral" | "uncertain";
export type FishId = "crucian" | "perch" | "carp" | "trout" | "bass" | "pike";
export type Phase =
  | "ready"
  | "charging"
  | "waiting"
  | "bite"
  | "fighting"
  | "landed"
  | "escaped";
export type StockId = BaitId | ChumId;

/** A three-axis scent profile. Values are relative component amounts. */
export interface ScentProfile {
  savory: number;
  sweet: number;
  ferment: number;
}

export interface ScentRange {
  low: number;
  high: number;
}

export type ComponentRanges = Record<ScentComponent, ScentRange>;

export interface FishSpecies {
  id: FishId;
  name: string;
  latin: string;
  color: string;
  rarity: string;
  min: number;
  max: number;
  strength: number;
  waters: SpotId[];
  baits: BaitId[];
  /** Positive values draw the fish in, negative values put it off. */
  scent: ScentProfile;
  note: string;
}

/**
 * One physical deposit of groundbait (诱窝 / chum).
 * Deposits are tracked individually so overlapping casts never lose their
 * origin, age or release rate. A deposit only emits while it is active.
 */
export interface ChumPortion {
  id: string;
  castId: string;
  castNumber: number;
  spot: SpotId;
  zone: string;
  chum: ChumId;
  hook: BaitId;
  /** Global game clock (seconds) when the deposit hit the water. */
  bornAt: number;
  /** Seconds of effective release. */
  lifespan: number;
  /** Effective units emitted per second at full remaining mass. */
  releaseRate: number;
  /** Per-portion vigour; two portions may share a concentration but not a rate. */
  vigor: number;
  /** Effective mass at birth (grams). */
  initial: number;
}

export interface ScentSource {
  id: string;
  kind: "chum" | "hook";
  label: string;
  chum: ChumId | null;
  hook: BaitId | null;
  spot: SpotId;
  zone: string;
  zoneName: string;
  castNumber: number | null;
  bornAt: number | null;
  age: number;
  lifespan: number | null;
  remaining: number;
  remainingRatio: number;
  releaseRate: number;
  /** Attenuation of this source's scent at the measured zone. */
  transmission: number;
  hops: number;
  components: ComponentRanges;
}

export interface InteractionEffect {
  pair: [ScentComponent, ScentComponent];
  kind: "synergy" | "conflict";
  name: string;
  /** Amount added (synergy) or removed (conflict) per component. */
  amount: ScentRange;
  /** Which sources met to produce this effect. */
  between: [string, string];
}

/**
 * A merged view of portions that can be safely treated as one odour field.
 * Portions are only merged when they share zone, recipe, release rate and
 * a similar remaining life. Everything else stays separate on purpose.
 */
export interface FieldGroup {
  id: string;
  chum: ChumId;
  zone: string;
  zoneName: string;
  spot: SpotId;
  portionIds: string[];
  count: number;
  remaining: number;
  remainingRatio: number;
  releaseRate: number;
  components: ComponentRanges;
  merged: boolean;
  /** Relative error introduced by approximating this group as one field. */
  mergeError: number;
  note: string | null;
}

export interface ScentReport {
  spot: SpotId;
  zone: string;
  zoneName: string;
  at: number;
  /** Effective component amounts after co-presence interactions. */
  components: ComponentRanges;
  /** Sum of active sources before interactions. */
  raw: ComponentRanges;
  /** Net change produced by synergy / conflict. */
  interactionDelta: ComponentRanges;
  sources: ScentSource[];
  groups: FieldGroup[];
  interactions: InteractionEffect[];
  chumSourceCount: number;
  /** Total relative approximation error of the merged view. */
  errorRatio: number;
  hookIncluded: boolean;
}

export interface FishScentRead {
  fish: FishId;
  /** Signed attraction score after interactions and hook entry bias. */
  score: ScentRange;
  /** Contribution of each scent component to the score. */
  contribution: ComponentRanges;
  /** What the same components would score without interaction effects. */
  rawContribution: ComponentRanges;
  /** Hook-derived entry preference (钩饵入口偏好), independent of chum. */
  entry: ScentRange;
  tier: ScentTier;
}

export interface BiteScentReport extends ScentReport {
  fish: FishId;
  read: FishScentRead;
  /** Seconds of sustained contact accumulated during this cast. */
  contact: number;
  /** Signed accumulated exposure for the fish that eventually bit. */
  exposure: number;
  /** Contact budget this fish needed before committing. */
  need: number;
  tier: ScentTier;
}

export interface ComboPart {
  portionId: string;
  chum: ChumId;
  castNumber: number;
  zone: string;
  zoneName: string;
  bornAt: number;
  age: number;
  remaining: number;
  remainingRatio: number;
  components: ComponentRanges;
}

/** The combination that was actually present when the fish took the hook. */
export interface ComboSnapshot {
  key: string;
  label: string;
  hook: BaitId;
  chum: ChumId | null;
  chums: ChumId[];
  parts: ComboPart[];
  tier: ScentTier;
  components: ComponentRanges;
  at: number;
  castId: string;
  /** True when portions from more than one cast overlapped at the bite. */
  layered: boolean;
  /** Which co-presence effects actually fired on the take. */
  effects: { kind: "synergy" | "conflict"; name: string }[];
}

export interface Catch {
  id: string;
  fish: FishId;
  weight: number;
  spot: SpotId;
  /** Hook bait. Kept as `bait` so older handbooks keep working. */
  bait: BaitId;
  chum?: ChumId | null;
  combo?: ComboSnapshot;
  time: number;
  duration: number;
  peakTension: number;
}

export interface JournalCombo {
  count: number;
  label: string;
  layered: boolean;
}

export interface JournalEntry {
  count: number;
  best: number;
  first: number;
  /** Keyed by ComboSnapshot.key; recorded when the hook was actually taken. */
  combos?: Record<string, JournalCombo>;
}

export interface GameDocument {
  version: 2;
  spot: SpotId;
  /** Hook bait (钩饵). */
  hook: BaitId;
  /** Groundbait (诱窝); null means a bare-hook cast. */
  chum: ChumId | null;
  power: number;
  drag: number;
  seed: number;
  stock: Record<StockId, number>;
  /** One global game clock shared by every water. */
  clock: number;
  chumField: ChumPortion[];
  lastDrop: { spot: SpotId; zone: string } | null;
  bag: Catch[];
  journal: Partial<Record<FishId, JournalEntry>>;
  stats: { casts: number; catches: number; escapes: number; released: number };
  claimed: string[];
}

export interface Session {
  id: string;
  phase: Phase;
  clock: number;
  charge: number;
  castPower: number;
  spot: SpotId;
  hook: BaitId;
  chum: ChumId | null;
  zone: string;
  /** Global game clock at the moment the rig hit the water. */
  startedAt: number;
  fish: FishId | null;
  weight: number;
  progress: number;
  tension: number;
  energy: number;
  slackTime: number;
  overload: number;
  peak: number;
  reeling: boolean;
  duration: number;
  message: string;
  /** Deterministic rolls drawn when the cast was prepared. */
  fishRoll: number;
  sizeRoll: number;
  /** Sustained scent contact (concentration × time) per fish. */
  exposure: Partial<Record<FishId, number>>;
  /** Frozen at the instant of the bite. */
  biteScent: BiteScentReport | null;
  combo: ComboSnapshot | null;
}

export interface Workspace {
  doc: GameDocument;
  session: Session;
  notice: string;
}
