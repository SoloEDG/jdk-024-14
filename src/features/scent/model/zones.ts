import type { SpotId } from "../../../shared/types";

export interface ZoneDef {
  id: string;
  name: string;
  note: string;
  /** Where the zone sits on the lake scene, in the scene's 1000x510 space. */
  x: number;
  y: number;
}

interface ZoneMap {
  zones: ZoneDef[];
  /** Undirected water connections with transmission in (0, 1]. */
  edges: [string, string, number][];
  /** Time constant for scent lingering, in game seconds. */
  diffusion: number;
  /** How fast the local current releases scent, by zone. */
  release: Record<string, number>;
  /** Zone pairs that look close but are cut off by land ("隔岸"). */
  cut: [string, string][];
}

/**
 * Each water is split into reachable zones. Scent can only travel along the
 * listed water connections; the "cut" pairs are separated by a bank or a
 * sandbar, so even two identical clouds there never mix.
 */
export const zoneMaps: Record<SpotId, ZoneMap> = {
  reed: {
    zones: [
      { id: "reed-root", name: "芦苇根", note: "近岸草缝，窝料最容易留住", x: 560, y: 300 },
      { id: "reed-bay", name: "湾心", note: "缓流回旋，气味散得慢", x: 700, y: 330 },
      { id: "reed-bank", name: "对岸浅滩", note: "隔着沙洲，与近岸互不相通", x: 840, y: 285 },
    ],
    edges: [
      ["reed-root", "reed-bay", 0.9],
      ["reed-bay", "reed-bank", 0.55],
    ],
    cut: [["reed-root", "reed-bank"]],
    diffusion: 20,
    release: { "reed-root": 0.92, "reed-bay": 1, "reed-bank": 1.18 },
  },
  brook: {
    zones: [
      { id: "brook-pool", name: "石潭", note: "水深流缓，香味沉得住", x: 570, y: 315 },
      { id: "brook-riffle", name: "浅滩", note: "水流加快，气味被带向下游", x: 700, y: 345 },
      { id: "brook-bend", name: "下游回湾", note: "与石潭被石梁隔断", x: 855, y: 320 },
    ],
    edges: [
      ["brook-pool", "brook-riffle", 0.8],
      ["brook-riffle", "brook-bend", 0.7],
    ],
    cut: [["brook-pool", "brook-bend"]],
    diffusion: 13,
    release: { "brook-pool": 0.9, "brook-riffle": 1.28, "brook-bend": 1.1 },
  },
  deep: {
    zones: [
      { id: "deep-shelf", name: "近岸台", note: "坡度平缓，适合试窝", x: 580, y: 300 },
      { id: "deep-basin", name: "湖心", note: "水面开阔，气味稀释明显", x: 710, y: 340 },
      { id: "deep-trench", name: "深槽", note: "被湖脊隔开，与近岸台不通", x: 860, y: 300 },
    ],
    edges: [
      ["deep-shelf", "deep-basin", 0.75],
      ["deep-basin", "deep-trench", 0.6],
    ],
    cut: [["deep-shelf", "deep-trench"]],
    diffusion: 24,
    release: { "deep-shelf": 0.88, "deep-basin": 1, "deep-trench": 1.14 },
  },
};

export function spotZones(spot: SpotId): ZoneDef[] {
  return zoneMaps[spot].zones;
}

export function zoneName(spot: SpotId, zone: string) {
  return zoneMaps[spot].zones.find((z) => z.id === zone)?.name ?? zone;
}

/** Longest allowed transmission path between two zones (max-product). */
export function transmission(spot: SpotId, from: string, to: string): number {
  if (from === to) return 1;
  const map = zoneMaps[spot];
  const best = new Map<string, number>([[from, 1]]);
  const seen = new Set<string>();
  while (true) {
    let current: string | null = null;
    let value = 0;
    for (const [id, v] of best)
      if (!seen.has(id) && v > value) {
        current = id;
        value = v;
      }
    if (current === null || current === to) break;
    seen.add(current);
    for (const [a, b, t] of map.edges) {
      const next = a === current ? b : b === current ? a : null;
      if (!next || t <= 0) continue;
      const candidate = value * t;
      if (candidate > (best.get(next) ?? 0)) best.set(next, candidate);
    }
  }
  return best.get(to) ?? 0;
}

export function isCut(spot: SpotId, a: string, b: string) {
  return zoneMaps[spot].cut.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/** Where a cast of the given power lands. */
export function dropZone(spot: SpotId, charge: number) {
  const zones = spotZones(spot);
  if (charge < 0.42) return zones[0].id;
  if (charge < 0.78) return zones[1].id;
  return zones[zones.length - 1].id;
}

export function zonePoint(spot: SpotId, zone: string) {
  const z = spotZones(spot).find((v) => v.id === zone) ?? spotZones(spot)[0];
  return { x: z.x, y: z.y };
}

export function defaultZone(spot: SpotId) {
  return spotZones(spot)[0].id;
}

export function diffusion(spot: SpotId) {
  return zoneMaps[spot].diffusion;
}

/**
 * True when two zones touch across a bank/sandbar: scent still drifts around
 * through the connected channel, but the two deposits are never treated as
 * one field just because they currently read the same concentration.
 */
export function acrossBank(spot: SpotId, a: string, b: string) {
  return isCut(spot, a, b);
}

/**
 * Local release multiplier. Portions dropped in different currents release at
 * different speeds even when they currently read the same concentration, so
 * they must never be collapsed into a single field.
 */
export function releaseVigor(spot: SpotId, zone: string) {
  return zoneMaps[spot].release[zone] ?? 1;
}
