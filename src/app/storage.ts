import { newDocument } from "../shared/initial";
import { fishCatalog } from "../shared/catalog";
import type {
  GameDocument,
  ScentComponent,
  SpotId,
} from "../shared/types";
const key = "stillwater-jdk024-v2";
const legacyKey = "stillwater-jdk024-v1";
const baits = ["worm", "corn", "fly"];
const chums = ["rice", "shrimp", "bran"];
const spots = ["reed", "brook", "deep"];
const components: ScentComponent[] = ["savory", "sweet", "ferment"];

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validRanges(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return ["low", "high"].every((k) => finite(r[k]));
}

function validComponents(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return components.every((c) => validRanges(r[c]));
}

export function valid(value: unknown): value is GameDocument {
  if (!value || typeof value !== "object") return false;
  const d = value as GameDocument;
  const fishIds = fishCatalog.map((f) => f.id);
  if (!(d.version === 2)) return false;
  if (!spots.includes(d.spot)) return false;
  if (!baits.includes(d.hook)) return false;
  if (d.chum !== null && !chums.includes(d.chum)) return false;
  if (!finite(d.power) || d.power < 0.15 || d.power > 0.95) return false;
  if (!finite(d.drag) || d.drag < 0.15 || d.drag > 0.95) return false;
  if (!Number.isInteger(d.seed)) return false;
  if (!finite(d.clock) || d.clock < 0) return false;
  if (!d.stock) return false;
  const stockOk = [...baits, ...chums].every((id) => {
    const n = d.stock[id as keyof typeof d.stock];
    return Number.isInteger(n) && n >= 0;
  });
  if (!stockOk) return false;
  if (!d.stats) return false;
  if (
    !["casts", "catches", "escapes", "released"].every((k) => {
      const n = d.stats[k as keyof typeof d.stats];
      return Number.isInteger(n) && n >= 0;
    })
  )
    return false;
  if (!Array.isArray(d.claimed)) return false;
  if (!d.claimed.every((c) => typeof c === "string")) return false;
  if (!Array.isArray(d.chumField)) return false;
  const fieldOk = d.chumField.every((p) => {
    if (!p || typeof p !== "object") return false;
    return (
      typeof p.id === "string" &&
      spots.includes(p.spot) &&
      chums.includes(p.chum) &&
      typeof p.zone === "string" &&
      finite(p.bornAt) &&
      finite(p.lifespan) &&
      p.lifespan > 0 &&
      finite(p.releaseRate) &&
      finite(p.initial) &&
      finite(p.vigor) &&
      Number.isInteger(p.castNumber) &&
      baits.includes(p.hook)
    );
  });
  if (!fieldOk) return false;
  if (!Array.isArray(d.bag)) return false;
  const bagOk = d.bag.every((c) => {
    if (!c || typeof c !== "object") return false;
    if (
      typeof c.id !== "string" ||
      !fishIds.includes(c.fish) ||
      !spots.includes(c.spot) ||
      !baits.includes(c.bait) ||
      ![c.weight, c.time, c.duration, c.peakTension].every(finite)
    )
      return false;
    if (c.combo) {
      if (!validComponents(c.combo.components)) return false;
      if (typeof c.combo.key !== "string" || typeof c.combo.label !== "string")
        return false;
      if (!Array.isArray(c.combo.parts)) return false;
    }
    return true;
  });
  if (!bagOk) return false;
  if (!d.journal) return false;
  const journalOk = Object.entries(d.journal).every(([id, e]) => {
    if (!fishIds.includes(id as (typeof fishIds)[number])) return false;
    if (!e || !Number.isInteger(e.count) || e.count <= 0) return false;
    if (!finite(e.best) || !finite(e.first)) return false;
    if (e.combos) {
      const combosOk = Object.entries(e.combos).every(([, combo]) => {
        return (
          combo &&
          Number.isInteger(combo.count) &&
          combo.count > 0 &&
          typeof combo.label === "string" &&
          typeof combo.layered === "boolean"
        );
      });
      if (!combosOk) return false;
    }
    return true;
  });
  if (!journalOk) return false;
  return true;
}

/** Convert a v1 save into the combined rig format. Old single-bait catches stay. */
export function migrateLegacy(raw: unknown): GameDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const old = raw as Record<string, unknown>;
  if (old.version !== 1 || !baits.includes(old.bait as string)) return null;
  const doc = newDocument();
  const spot = spots.includes(old.spot as string)
    ? (old.spot as SpotId)
    : "reed";
  const stock = old.stock as Record<string, number> | undefined;
  const stats = old.stats as GameDocument["stats"] | undefined;
  return {
    ...doc,
    spot,
    hook: old.bait as GameDocument["hook"],
    chum: null,
    power: finite(old.power) ? old.power : doc.power,
    drag: finite(old.drag) ? old.drag : doc.drag,
    seed: Number.isInteger(old.seed) ? (old.seed as number) : doc.seed,
    stock: {
      ...doc.stock,
      ...(stock && finite(stock.worm)
        ? { worm: stock.worm, corn: stock.corn, fly: stock.fly }
        : {}),
    },
    bag: Array.isArray(old.bag)
      ? (old.bag as GameDocument["bag"]).map((c) => ({
          ...c,
          chum: null,
        }))
      : [],
    journal: (old.journal as GameDocument["journal"]) ?? {},
    stats: stats ?? doc.stats,
    claimed: Array.isArray(old.claimed)
      ? (old.claimed as string[])
      : doc.claimed,
    clock: 0,
    chumField: [],
    lastDrop: null,
  };
}

export function loadGame(): {
  doc: GameDocument;
  notice: string;
  recovery?: true;
} {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      return valid(parsed)
        ? { doc: parsed, notice: "" }
        : {
            doc: newDocument(),
            notice:
              "本地手记格式或版本无法读取，已保留原手记并开启临时游玩。",
            recovery: true,
          };
    }
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      const migrated = migrateLegacy(JSON.parse(legacy));
      if (migrated)
        return {
          doc: migrated,
          notice: "旧手记已升级：单饵记录保留，可继续按钩饵 + 诱窝出竿。",
        };
    }
    return { doc: newDocument(), notice: "" };
  } catch {
    return {
      doc: newDocument(),
      notice: "无法读取本地手记，已暂停自动保存，本次可以临时游玩。",
      recovery: true,
    };
  }
}
export function saveGame(doc: GameDocument) {
  try {
    localStorage.setItem(key, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}
