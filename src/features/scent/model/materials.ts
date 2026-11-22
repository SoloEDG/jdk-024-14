import type {
  BaitId,
  ChumId,
  ScentComponent,
  ScentProfile,
} from "../../../shared/types";

export interface ComponentInfo {
  id: ScentComponent;
  name: string;
  short: string;
  color: string;
  note: string;
}

export const componentOrder: ScentComponent[] = ["savory", "sweet", "ferment"];

export const componentInfo: Record<ScentComponent, ComponentInfo> = {
  savory: {
    id: "savory",
    name: "腥香",
    short: "腥",
    color: "#b47b62",
    note: "动物蛋白与氨基酸，掠食鱼与底层鱼敏感。",
  },
  sweet: {
    id: "sweet",
    name: "甜香",
    short: "甜",
    color: "#c8a24f",
    note: "谷物与糖分，鲤鲫偏爱，部分掠食鱼反感。",
  },
  ferment: {
    id: "ferment",
    name: "酵香",
    short: "酵",
    color: "#7f9a6d",
    note: "发酵与酒香，扩散快，能叠出复合气味。",
  },
};

export interface HookBaitInfo {
  id: BaitId;
  name: string;
  short: string;
  icon: string;
  note: string;
  color: string;
  /** Scent shed by the bait on the hook, relative to one chum portion. */
  scent: ScentProfile;
  /** Share of the scent that actually leaves the hook. */
  coating: number;
}

export const hookBaitInfo: Record<BaitId, HookBaitInfo> = {
  worm: {
    id: "worm",
    name: "鲜活蚯蚓",
    short: "蚯蚓",
    icon: "〰",
    note: "均衡 · 鲫鱼 / 河鲈",
    color: "#ba8477",
    scent: { savory: 0.8, sweet: 0.15, ferment: 0.25 },
    coating: 0.55,
  },
  corn: {
    id: "corn",
    name: "甜玉米粒",
    short: "玉米",
    icon: "⠿",
    note: "素饵 · 锦鲤偏爱",
    color: "#d4ac62",
    scent: { savory: 0.15, sweet: 0.85, ferment: 0.2 },
    coating: 0.55,
  },
  fly: {
    id: "fly",
    name: "羽毛拟蝇",
    short: "拟蝇",
    icon: "⌁",
    note: "拟饵 · 掠食鱼偏爱",
    color: "#779ba0",
    scent: { savory: 0.65, sweet: 0.05, ferment: 0.05 },
    coating: 0.5,
  },
};

export interface ChumInfo {
  id: ChumId;
  name: string;
  short: string;
  icon: string;
  note: string;
  color: string;
  /** Scent released by one full portion, per component. */
  scent: ScentProfile;
  /** Effective release window in game seconds. */
  lifespan: number;
  /** Multiplier on emitted scent; fast-breakdown chum releases harder. */
  releaseRate: number;
  /** Reference mass of one portion in grams. */
  portion: number;
}

export const chumInfo: Record<ChumId, ChumInfo> = {
  rice: {
    id: "rice",
    name: "酒米窝",
    short: "酒米",
    icon: "✳",
    note: "甜酵 · 留鱼久，释放平稳",
    color: "#c9a86a",
    scent: { savory: 0.1, sweet: 0.55, ferment: 0.75 },
    lifespan: 90,
    releaseRate: 1,
    portion: 100,
  },
  shrimp: {
    id: "shrimp",
    name: "虾粉窝",
    short: "虾粉",
    icon: "❋",
    note: "浓腥 · 慢释，掠食鱼偏爱",
    color: "#b4766d",
    scent: { savory: 0.85, sweet: 0.08, ferment: 0.32 },
    lifespan: 75,
    releaseRate: 0.8,
    portion: 100,
  },
  bran: {
    id: "bran",
    name: "麸皮窝",
    short: "麸皮",
    icon: "≡",
    note: "甜酵 · 快散，短时聚鱼",
    color: "#c2ad72",
    scent: { savory: 0.22, sweet: 0.48, ferment: 0.52 },
    lifespan: 55,
    releaseRate: 1.35,
    portion: 100,
  },
};

export function hookBaitName(id: BaitId) {
  return hookBaitInfo[id].name;
}
export function chumName(id: ChumId) {
  return chumInfo[id].name;
}
