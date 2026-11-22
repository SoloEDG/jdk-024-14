import type { GameDocument } from "../../../shared/types";
import { learnedCombos, layeredCombos } from "../../collection/lib/records";

export interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  reward: string;
  unlockAt: number;
  measure: (doc: GameDocument) => number;
  /** Challenges that are judged on the combination at the time of the take. */
  basis?: string;
}
export const challenges: Challenge[] = [
  {
    id: "first",
    unlockAt: 0,
    name: "初次相遇",
    description: "成功捕获你的第一尾鱼",
    target: 1,
    reward: "启程徽章",
    measure: (d) => d.stats.catches,
  },
  {
    id: "explorer",
    unlockAt: 1,
    name: "溪流来信",
    description: "累计捕获 2 尾鱼",
    target: 2,
    reward: "青石溪流",
    measure: (d) => d.stats.catches,
  },
  {
    id: "collector",
    unlockAt: 1,
    name: "不同的风景",
    description: "发现 3 个不同鱼种",
    target: 3,
    reward: "博物手记",
    measure: (d) => Object.keys(d.journal).length,
  },
  {
    id: "deep",
    unlockAt: 2,
    name: "向湖心出发",
    description: "累计捕获 5 尾鱼",
    target: 5,
    reward: "镜湖深水",
    measure: (d) => d.stats.catches,
  },
  {
    id: "release",
    unlockAt: 1,
    name: "让相遇继续",
    description: "放流 3 尾鱼",
    target: 3,
    reward: "护水徽章",
    measure: (d) => d.stats.released,
  },
  {
    id: "blend",
    unlockAt: 1,
    name: "复合的味道",
    description: "用钩饵 + 诱窝的组合收获 2 尾鱼",
    target: 2,
    reward: "调香笔记",
    measure: (d) =>
      Object.values(d.journal).reduce(
        (n, entry) =>
          n +
          Object.keys(entry?.combos ?? {}).filter(
            (key) => !key.startsWith("legacy:") && key.includes("|"),
          ).length,
        0,
      ),
    basis: "按上钩瞬间实际起作用的钩饵 + 诱窝计。",
  },
  {
    id: "layered",
    unlockAt: 2,
    name: "隔竿叠窝",
    description: "在两次以上窝料叠加处收获 1 尾鱼",
    target: 1,
    reward: "窝点图",
    measure: (d) => layeredCombos(d.journal),
    basis: "只在两竿窝料的释放窗口真正重叠时计入。",
  },
  {
    id: "palette",
    unlockAt: 2,
    name: "香谱渐丰",
    description: "记录 4 种不同的实际组合",
    target: 4,
    reward: "气味手札",
    measure: (d) => learnedCombos(d.journal),
    basis: "手记按上钩瞬间起作用的组合分列。",
  },
];
