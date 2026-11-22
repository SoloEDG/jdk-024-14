import type {
  ComponentRanges,
  FieldGroup,
  ScentRange,
  ScentSource,
  ScentTier,
} from "../../../shared/types";
import {
  chumInfo,
  componentInfo,
  componentOrder,
  hookBaitInfo,
} from "../model/materials";
import type { BuiltReport } from "./core";
import { tierLabel } from "./core";

export function fmt(n: number, digits = 2) {
  return n.toFixed(digits);
}

/** Readings keep two decimals; anything below 0.005 shows as 0. */
export function fmtAmount(n: number) {
  if (Math.abs(n) < 0.005) return "0";
  if (Math.abs(n) >= 10) return n.toFixed(0);
  return n.toFixed(2);
}

export function fmtRange(r: ScentRange) {
  const low = fmtAmount(r.low);
  const high = fmtAmount(r.high);
  if (low === high) return low;
  return `${low}–${high}`;
}

export function fmtSigned(r: ScentRange, digits = 2) {
  const sign = (n: number) => (n >= 0 ? "+" : "");
  if (Math.abs(r.high - r.low) < 1e-9)
    return `${sign(r.low)}${fmt(r.low, digits)}`;
  return `${sign(r.low)}${fmt(r.low, digits)} … ${sign(r.high)}${fmt(r.high, digits)}`;
}

export function componentBars(r: ComponentRanges) {
  const max = Math.max(
    0.001,
    ...componentOrder.map((c) => r[c].high),
  );
  return componentOrder.map((c) => ({
    ...componentInfo[c],
    low: r[c].low,
    high: r[c].high,
    width: (r[c].high / max) * 100,
  }));
}

export function tierClass(tier: ScentTier) {
  return `tier tier-${tier}`;
}

export function tierText(tier: ScentTier) {
  return tierLabel(tier);
}

export function sourceTitle(source: ScentSource) {
  if (source.kind === "hook") return `钩饵 · ${source.label}`;
  return `诱窝 · ${source.label}`;
}

export function sourceSubtitle(source: ScentSource) {
  if (source.kind === "hook") {
    return `${source.zoneName} · 持续附着`;
  }
  return `第 ${source.castNumber} 竿 · ${source.zoneName} · 已过 ${Math.round(source.age)} 秒`;
}

export function groupTitle(group: FieldGroup) {
  return `${chumInfo[group.chum].name} × ${group.count}`;
}

export function groupSubtitle(group: FieldGroup) {
  return `${group.zoneName} · 剩余 ${Math.round(group.remainingRatio * 100)}% · 释放 ×${fmt(group.releaseRate)}`;
}

export function hookLabel(id: string) {
  return hookBaitInfo[id as keyof typeof hookBaitInfo]?.short ?? id;
}

export function reportHeading(report: BuiltReport | null) {
  if (!report) return "尚无气味读数";
  return `${report.zoneName} · ${Math.round(report.at)} 秒`;
}
