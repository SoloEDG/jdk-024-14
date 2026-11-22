import { useMemo } from "react";
import { Waves, TriangleAlert } from "lucide-react";
import type { GameDocument, Session } from "../../../shared/types";
import type { Command } from "../../../shared/commands";
import {
  buildReport,
  rangeMid,
  readFish,
  tierLabel,
} from "../lib/core";
import { spotZones } from "../model/zones";
import { chumInfo, componentInfo, componentOrder } from "../model/materials";
import { fmtRange, fmtSigned } from "../lib/display";
import { scoreBar } from "../lib/outlook";

export function ScentField({
  doc,
  session,
  busy,
  send,
}: {
  doc: GameDocument;
  session: Session;
  busy: boolean;
  send: (c: Command) => void;
}) {
  const inWater = ["waiting", "bite", "fighting"].includes(session.phase);
  const zone = inWater
    ? session.zone
    : doc.lastDrop?.spot === doc.spot
      ? doc.lastDrop.zone
      : spotZones(doc.spot)[0].id;
  const hook = inWater && session.spot === doc.spot ? session.hook : null;
  const hookBornAt = inWater ? session.startedAt : doc.clock;
  const report = useMemo(
    () =>
      buildReport(doc, doc.spot, zone, doc.clock, {
        hook: hook ? { bait: hook, zone, bornAt: hookBornAt } : undefined,
      }),
    [doc, zone, hook, hookBornAt],
  );
  const reading = useMemo(
    () =>
      buildReport(doc, doc.spot, zone, doc.clock, {
        merge: true,
        hook: hook ? { bait: hook, zone, bornAt: hookBornAt } : undefined,
      }),
    [doc, zone, hook, hookBornAt],
  );
  const fishes = species2(doc.spot);
  const outlook = useMemo(
    () =>
      fishes.map((f) => {
        const read = readFish(reading, f.id);
        return { fish: f, read, tier: read.tier };
      }),
    [reading, fishes],
  );
  return (
    <section className="scent-panel">
      <div className="section-title">
        <Waves size={17} />
        <h2>气味场</h2>
        <span>
          {report.chumSourceCount} 份窝料 · 读数误差{" "}
          {Math.round(reading.errorRatio * 100)}%
        </span>
      </div>
      <p className="muted intro">
        {report.zoneName} · 游戏时间 {Math.round(report.at)} 秒。气味沿可通水区域扩散衰减，
        隔岸的窝料不会混入这里的读数。
      </p>
      <div className="scent-bars">
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
      <div className="scent-groups">
        <div className="scent-group-label">
          <span>逐份追踪 · 剩余有效量</span>
          <small>每份只在自己的释放窗口内计入</small>
        </div>
        {report.sources
          .filter((s) => s.kind === "chum")
          .sort((a, b) => b.remainingRatio - a.remainingRatio)
          .map((s) => (
            <div className="scent-group" key={s.id}>
              <span
                className="dot"
                style={{ background: chumInfo[s.chum!].color }}
              />
              <div>
                <strong>
                  {chumInfo[s.chum!].short} · 第 {s.castNumber} 竿
                </strong>
                <small>
                  {s.zoneName} · 剩余 {Math.round(s.remainingRatio * 100)}%（
                  {s.remaining.toFixed(0)} g）· 速率 ×
                  {s.releaseRate.toFixed(2)}
                  {s.transmission < 0.999 &&
                    ` · 传至此处 ×${s.transmission.toFixed(2)}`}
                </small>
              </div>
              <b title="腥 / 甜 / 酵">
                {fmtRange(s.components.savory)} / {fmtRange(s.components.sweet)} /{" "}
                {fmtRange(s.components.ferment)}
              </b>
            </div>
          ))}
        {report.chumSourceCount === 0 && (
          <small className="muted">这里暂无可闻到的时间重叠窝料。</small>
        )}
        {hook && (
          <div className="scent-group hook-source">
            <span className="dot" style={{ background: "#7a9b90" }} />
            <div>
              <strong>钩饵气味</strong>
              <small>钩饵只影响入口偏好，衰减快。</small>
            </div>
            <b>附着</b>
          </div>
        )}
      </div>
      <div className="scent-groups">
        <div className="scent-group-label">
          <span>合并气味场 · 长期投放</span>
          <small>同区 · 同配方 · 同释放速率 · 剩余寿命相近才合并</small>
        </div>
        {reading.groups.map((g) => (
          <div className="scent-group" key={g.id}>
            <span
              className="dot"
              style={{ background: chumInfo[g.chum].color }}
            />
            <div>
              <strong>
                {chumInfo[g.chum].short} × {g.count}
              </strong>
              <small>
                {g.zoneName} · 剩余 {Math.round(g.remainingRatio * 100)}%（
                {g.remaining.toFixed(0)} g）· 速率 ×
                {g.releaseRate.toFixed(2)}
              </small>
              {g.note && <em>{g.note}</em>}
            </div>
            <b>{g.merged ? `合并 ${g.count} 份` : "单独"}</b>
          </div>
        ))}
        {reading.groups.length === 0 && (
          <small className="muted">无可合并的窝料。</small>
        )}
        {reading.errorRatio > 0 && (
          <small className="muted">
            近似误差 {(reading.errorRatio * 100).toFixed(1)}%：区间跨过吸引 / 排斥阈值时，
            鱼种判断保留为“不确定”。
          </small>
        )}
      </div>
      <div className="outlook">
        <div className="scent-group-label">
          <span>鱼种倾向 · 本区</span>
          <small>吸引 ≥ 0.40 · 排斥 ≤ -0.28</small>
        </div>
        {outlook.map(({ fish, read, tier }) => {
          const bar = scoreBar(read);
          return (
            <div className="outlook-row" key={fish.id}>
              <span className="outlook-name">{fish.name}</span>
              <div className="score-track">
                <i className="score-zone" />
                <i className="score-mark attract" style={{ left: `${bar.attractAt}%` }} />
                <i className="score-mark repel" style={{ left: `${bar.repelAt}%` }} />
                <i
                  className={"score-fill tier-" + tier}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                />
              </div>
              <b className={"tier-text tier-" + tier}>{tierLabel(tier)}</b>
            </div>
          );
        })}
        {reading.errorRatio > 0 && (
          <small className="muted outlook-warn">
            <TriangleAlert size={11} /> 近似误差未消除，阈值附近的判断请当作不确定。
          </small>
        )}
      </div>
      <div className="scent-preview">
        {spotZones(doc.spot).map((z) => {
          const r = buildReport(doc, doc.spot, z.id, doc.clock);
          const parts = componentOrder
            .filter((c) => rangeMid(r.components[c]) > 0.04)
            .map((c) => componentInfo[c].short);
          return (
            <span key={z.id} className={z.id === zone ? "active" : ""}>
              {z.name} {parts.join("") || "无味"}
            </span>
          );
        })}
      </div>
      <button
        className="text-btn"
        disabled={busy || doc.chumField.length === 0}
        onClick={() => send({ type: "clear-field" })}
      >
        清空本水域窝料
      </button>
    </section>
  );
}

// Local helper so this component does not need to import the waters feature.
import { fishCatalog } from "../../../shared/catalog";
function species2(spot: GameDocument["spot"]) {
  return fishCatalog.filter((f) => f.waters.includes(spot));
}
