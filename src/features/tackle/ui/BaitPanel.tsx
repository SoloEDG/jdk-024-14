import { PackageOpen, RefreshCw, Check, CircleSlash } from "lucide-react";
import type { GameDocument } from "../../../shared/types";
import type { Command } from "../../../shared/commands";
import { hookBaitInfo, chumInfo, componentInfo, componentOrder } from "../../scent/model/materials";
import { attraction } from "../lib/affinity";
import { checkLoadout } from "../model/loadout";
import { fmt } from "../../scent/lib/display";

export function BaitPanel({
  doc,
  busy,
  send,
}: {
  doc: GameDocument;
  busy: boolean;
  send: (c: Command) => void;
}) {
  const choices = attraction(doc.spot, doc.hook);
  const check = checkLoadout(doc);
  const favourite = choices
    .filter((v) => v.fish.baits.includes(doc.hook))
    .map((v) => v.fish.name)
    .join("、");
  return (
    <section className="bait-panel">
      <div className="section-title">
        <PackageOpen size={17} />
        <h2>鱼饵盒</h2>
        <button
          className="text-btn"
          disabled={busy}
          onClick={() => send({ type: "resupply" })}
        >
          <RefreshCw size={12} />
          补给
        </button>
      </div>
      <div className="loadout-head">
        <span>钩饵 · 影响入口偏好</span>
        <small>{favourite || "探索未知鱼群"}</small>
      </div>
      <div className="bait-list">
        {(Object.keys(hookBaitInfo) as GameDocument["hook"][]).map((id) => {
          const b = hookBaitInfo[id];
          return (
            <button
              key={id}
              disabled={busy || !doc.stock[id]}
              onClick={() => send({ type: "hook", id })}
              className={"bait-card " + (doc.hook === id ? "active" : "")}
              aria-pressed={doc.hook === id}
            >
              <span className="bait-icon" style={{ color: b.color }}>
                {b.icon}
              </span>
              <span>
                <strong>{b.name}</strong>
                <small>{b.note}</small>
              </span>
              <span className="stock">
                ×{doc.stock[id]}
                {doc.hook === id && <Check size={13} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="loadout-head chum-head">
        <span>诱窝 · 持续释香</span>
        <small>{doc.chum ? "与钩饵同扣" : "空钩出发"}</small>
      </div>
      <div className="chum-list">
        <button
          disabled={busy}
          onClick={() => send({ type: "chum", id: null })}
          className={"chum-card " + (doc.chum === null ? "active" : "")}
          aria-pressed={doc.chum === null}
        >
          <span className="chum-icon">
            <CircleSlash size={13} />
          </span>
          <span>
            <strong>不投窝</strong>
            <small>只靠钩饵，不扣窝料</small>
          </span>
          {doc.chum === null && <Check size={13} />}
        </button>
        {(Object.keys(chumInfo) as GameDocument["chum"][]).filter(
          (id): id is keyof typeof chumInfo => id !== null,
        ).map((id) => {
          const c = chumInfo[id];
          return (
            <button
              key={id}
              disabled={busy || !doc.stock[id]}
              onClick={() => send({ type: "chum", id })}
              className={"chum-card " + (doc.chum === id ? "active" : "")}
              aria-pressed={doc.chum === id}
            >
              <span className="chum-icon" style={{ color: c.color }}>
                {c.icon}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>{c.note}</small>
              </span>
              <span className="stock">×{doc.stock[id]}</span>
              {doc.chum === id && <Check size={13} />}
            </button>
          );
        })}
      </div>
      <div className="scent-legend" aria-label="成分图例">
        {componentOrder.map((c) => (
          <span key={c}>
            <i style={{ background: componentInfo[c].color }} />
            {componentInfo[c].name}
          </span>
        ))}
      </div>
      <div className="loadout-summary">
        <span>
          本竿整组：{hookBaitInfo[doc.hook].short}
          {doc.chum ? ` + ${chumInfo[doc.chum].short}` : ""}
        </span>
        <small>钩饵 1{doc.chum ? " · 窝料 1" : ""}</small>
      </div>
      {!check.ok && (
        <p className="loadout-warning">
          缺料：{check.missing.map((id) => (id in hookBaitInfo ? hookBaitInfo[id as keyof typeof hookBaitInfo].short : chumInfo[id as keyof typeof chumInfo].short)).join("、")}
          。整组不齐时不扣任何一项。
        </p>
      )}
      <p className="bait-hint">
        成分：腥 {fmt(hookBaitInfo[doc.hook].scent.savory)} · 甜{" "}
        {fmt(hookBaitInfo[doc.hook].scent.sweet)} · 酵{" "}
        {fmt(hookBaitInfo[doc.hook].scent.ferment)}。钩饵只影响入口偏好；
        窝味决定鱼是否会留下来。
      </p>
    </section>
  );
}
