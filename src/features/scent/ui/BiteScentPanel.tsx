import type {
  BaitId,
  BiteScentReport,
  FishScentRead,
  ScentRange,
} from "../../../shared/types";
import { species } from "../../../shared/catalog";
import { chumInfo, componentInfo, componentOrder, hookBaitInfo } from "../model/materials";
import { ATTRACT_THRESHOLD, REPEL_THRESHOLD, tierLabel } from "../lib/core";
import { fmtRange, fmtSigned } from "../lib/display";
import { scoreBar } from "../lib/outlook";

export function BiteScentPanel({ report }: { report: BiteScentReport }) {
  const fish = species(report.fish);
  const bar = scoreBar(report.read);
  const hook = report.sources.find((s) => s.kind === "hook");
  const chumSources = report.sources.filter((s) => s.kind === "chum");
  return (
    <section className="bite-scent">
      <div className="bite-scent-head">
        <span className="eyebrow">ON THE TAKE</span>
        <strong>
          上钩瞬间 · {fish.name} · <span className={"tier-text tier-" + report.tier}>{tierLabel(report.tier)}</span>
        </strong>
        <small>
          持续接触 {report.contact.toFixed(1)} / {report.need.toFixed(1)} 秒·浓度
        </small>
      </div>
      <div className="bite-scent-body">
        <div className="bite-bars">
          {componentOrder.map((c) => {
            const max = Math.max(
              0.001,
              ...componentOrder.map((x) => report.components[x].high),
            );
            return (
              <div className="scent-bar" key={c}>
                <span title={componentInfo[c].note}>{componentInfo[c].name}</span>
                <div className="scent-track">
                  <i
                    style={{
                      width: `${(report.components[c].high / max) * 100}%`,
                      background: componentInfo[c].color,
                    }}
                  />
                </div>
                <b>{fmtRange(report.components[c])}</b>
              </div>
            );
          })}
        </div>
        <div className="bite-score">
          <span>吸引分区间 · 含钩饵入口</span>
          <strong>{fmtSigned(report.read.score)}</strong>
          <span className={report.tier === "uncertain" ? "bite-flag" : "bite-flag quiet"}>
            {report.tier === "uncertain"
              ? "区间跨过阈值，判断保留不确定"
              : "区间未跨过阈值"}
          </span>
          <div className="score-track">
            <i className="score-zone" />
            <i className="score-mark attract" style={{ left: `${bar.attractAt}%` }} />
            <i className="score-mark repel" style={{ left: `${bar.repelAt}%` }} />
            <i
              className={"score-fill tier-" + report.tier}
              style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
            />
          </div>
          <small>
            吸引 ≥ {ATTRACT_THRESHOLD} · 排斥 ≤ {REPEL_THRESHOLD}
          </small>
        </div>
      </div>
      <div className="bite-contrib">
        <div className="scent-group-label">
          <span>各成分贡献范围</span>
          <small>逐份追踪 + 合并近似误差</small>
        </div>
        <ContributionRows read={report.read} hook={hook?.hook ?? null} />
      </div>
      <div className="bite-sources">
        {chumSources.map((s) => (
          <span key={s.id} className="bite-chip">
            {chumInfo[s.chum!].short} · 第 {s.castNumber} 竿 · {s.zoneName} · 剩余{" "}
            {Math.round(s.remainingRatio * 100)}%
          </span>
        ))}
        {chumSources.length === 0 && <span className="bite-chip">无诱窝</span>}
        <span className="bite-chip hook">
          钩饵 · {hookBaitInfo[hook?.hook ?? "worm"].short}
        </span>
        {report.sources.length > 1 && (
          <span className="bite-chip muted-chip">
            {new Set(chumSources.map((s) => s.castNumber)).size} 竿窝料叠加
          </span>
        )}
      </div>
      {report.interactions.length > 0 && (
        <div className="scent-interactions">
          {report.interactions.map((e, i) => (
            <span key={i} className={"interaction " + e.kind}>
              {e.kind === "synergy" ? "增强" : "抵消"} · {e.name}{" "}
              {fmtSigned(e.amount)}
            </span>
          ))}
        </div>
      )}
      <small className="muted">
        按上钩瞬间实际起作用的组合记录。先后经过的两团香味各按自己的时间窗计入，
        不会被当作同时混合。
      </small>
    </section>
  );
}

function ContributionRows({
  read,
  hook,
}: {
  read: FishScentRead;
  hook: BaitId | null;
}) {
  const rows: { name: string; color: string; range: ScentRange }[] =
    componentOrder.map((c) => ({
      name: componentInfo[c].name,
      color: componentInfo[c].color,
      range: read.contribution[c],
    }));
  if (hook)
    rows.push({
      name: `钩饵入口 · ${hookBaitInfo[hook].short}`,
      color: "#7a9b90",
      range: read.entry,
    });
  const total = rows.reduce(
    (n, r) => n + Math.abs((r.range.low + r.range.high) / 2),
    0,
  );
  return (
    <>
      {rows.map((r) => {
        const mid = (r.range.low + r.range.high) / 2;
        return (
          <div className="contrib-row" key={r.name}>
            <span>{r.name}</span>
            <div className="contrib-track">
              <i
                style={{
                  width: total > 0 ? `${(Math.abs(mid) / total) * 100}%` : "0%",
                  background: r.color,
                  opacity: mid < 0 ? 0.45 : 1,
                }}
              />
            </div>
            <b className={mid < 0 ? "negative" : ""}>{fmtSigned(r.range)}</b>
          </div>
        );
      })}
    </>
  );
}
