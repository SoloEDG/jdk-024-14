import { useState } from "react";
import { BookOpen, Backpack, ArrowUpRight, Layers } from "lucide-react";
import type { GameDocument } from "../../../shared/types";
import type { Command } from "../../../shared/commands";
import { fishCatalog, species } from "../../../shared/catalog";
import {
  bagWeight,
  comboBreakdown,
  layeredCombos,
  learnedCombos,
} from "../lib/records";
import { FishIllustration } from "./FishIllustration";
import { ComboDetails, ComboSummary } from "../../scent/ui/ComboDetails";
import { comboLabel } from "../../scent/lib/core";

export function CollectionPanel({
  doc,
  send,
}: {
  doc: GameDocument;
  send: (c: Command) => void;
}) {
  const [tab, setTab] = useState<"atlas" | "bag">("atlas");
  const [detail, setDetail] = useState<string | null>(null);
  const fish = detail ? species(detail) : null;
  const entry = fish ? doc.journal[fish.id] : undefined;
  return (
    <section className="collection-panel">
      <div className="section-title">
        <BookOpen size={17} />
        <h2>湖畔图鉴</h2>
        <span>
          {Object.keys(doc.journal).length} / {fishCatalog.length} 已发现
        </span>
      </div>
      <div className="mini-tabs">
        <button
          className={tab === "atlas" ? "active" : ""}
          onClick={() => setTab("atlas")}
        >
          <BookOpen size={13} />
          鱼类图鉴
        </button>
        <button
          className={tab === "bag" ? "active" : ""}
          onClick={() => setTab("bag")}
        >
          <Backpack size={13} />
          我的背包 <b>{doc.bag.length}</b>
        </button>
      </div>
      {tab === "atlas" ? (
        <>
          <div className="atlas-grid">
            {fishCatalog.map((f) => (
              <button
                className="fish-tile"
                key={f.id}
                onClick={() => setDetail(detail === f.id ? null : f.id)}
                aria-expanded={detail === f.id}
              >
                <FishIllustration fish={f} locked={!doc.journal[f.id]} />
                <span>{doc.journal[f.id] ? f.name : "待发现"}</span>
                <small>
                  {f.rarity}
                  <ArrowUpRight size={10} />
                </small>
              </button>
            ))}
          </div>
          {fish && (
            <div className="fish-detail">
              <strong>{fish.name}</strong>
              <em>{fish.latin}</em>
              <p>{fish.note}</p>
              <small>
                {entry
                  ? `捕获 ${entry.count} 尾 · 最大 ${entry.best.toFixed(2)} kg`
                  : "尝试探索它偏爱的水域与鱼饵。"}
              </small>
              {entry && Object.keys(entry.combos ?? {}).length > 0 && (
                <div className="combo-breakdown">
                  <span className="combo-label">
                    <Layers size={11} /> 实际起作用的组合
                  </span>
                  {comboBreakdown(entry).map(([key, combo]) => (
                    <div key={key}>{<ComboSummary combo={combo} />}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bag-list">
          <small>
            共 {doc.bag.length} 尾 · {bagWeight(doc.bag).toFixed(2)} kg
          </small>
          <div className="journal-combo-stats">
            <span>{learnedCombos(doc.journal)} 种组合</span>
            <span>{layeredCombos(doc.journal)} 次叠加</span>
          </div>
          {doc.bag.length === 0 && (
            <div className="empty-bag">
              <Backpack size={26} />
              <p>背包里还没有收获</p>
              <small>第一尾鱼，正等着与你相遇。</small>
            </div>
          )}
          {doc.bag.map((c) => (
            <div className="bag-item bag-item-combo" key={c.id}>
              <FishIllustration fish={species(c.fish)} />
              <span>
                <strong>{species(c.fish).name}</strong>
                <small>
                  {c.weight.toFixed(2)} kg · {comboLabel(c.combo)}
                </small>
              </span>
              <button
                className="text-btn"
                onClick={() => send({ type: "release", id: c.id })}
              >
                放流
              </button>
              {c.combo && (
                <details className="bag-combo">
                  <summary>组合来源</summary>
                  <ComboDetails combo={c.combo} compact />
                </details>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="collection-foot">把每一次相遇，留在手记里。</p>
    </section>
  );
}
