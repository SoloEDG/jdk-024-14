import type { ComboSnapshot, JournalCombo } from "../../../shared/types";
import { chumInfo, hookBaitInfo } from "../model/materials";
import { tierLabel } from "../lib/core";
import { fmtRange } from "../lib/display";

/** Explains where a recorded combination came from. */
export function ComboDetails({
  combo,
  compact = false,
}: {
  combo: ComboSnapshot;
  compact?: boolean;
}) {
  const layers = new Map<number, ComboSnapshot["parts"]>();
  for (const part of combo.parts) {
    const list = layers.get(part.castNumber) ?? [];
    list.push(part);
    layers.set(part.castNumber, list);
  }
  return (
    <div className={"combo-details " + (compact ? "compact" : "")}>
      <div className="combo-head">
        <strong>{combo.label}</strong>
        <span className={"tier-text tier-" + combo.tier}>
          {tierLabel(combo.tier)}
        </span>
      </div>
      <div className="combo-parts">
        {[...layers.entries()].map(([cast, parts]) => (
          <div className="combo-layer" key={cast}>
            <span className="combo-cast">第 {cast} 竿</span>
            {parts.map((p) => (
              <span className="combo-portion" key={p.portionId}>
                {chumInfo[p.chum].short} · {p.zoneName} · 剩余{" "}
                {Math.round(p.remainingRatio * 100)}%
                <b>
                  {fmtRange(p.components.savory)}/{fmtRange(p.components.sweet)}/
                  {fmtRange(p.components.ferment)}
                </b>
              </span>
            ))}
          </div>
        ))}
        {combo.parts.length === 0 && (
          <span className="combo-cast">无诱窝，仅钩饵</span>
        )}
      </div>
      <small className="combo-meta">
        钩饵 · {hookBaitInfo[combo.hook].short} ·{" "}
        {combo.layered ? "多竿窝料叠加，按各自时间窗计入" : "单层窝"}
      </small>
      {combo.effects.length > 0 && (
        <div className="combo-effects">
          {combo.effects.map((e, i) => (
            <span key={i} className={"interaction " + e.kind}>
              {e.kind === "synergy" ? "增强" : "抵消"} · {e.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComboSummary({ combo }: { combo: JournalCombo }) {
  return (
    <span className="combo-summary">
      {combo.label} × {combo.count}
      {combo.layered && <em>叠加</em>}
    </span>
  );
}
