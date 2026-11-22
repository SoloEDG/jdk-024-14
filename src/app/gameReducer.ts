import type { Workspace } from "../shared/types";
import type { Command } from "../shared/commands";
import { idleSession, isBusy } from "../shared/initial";
import { selectWater } from "../features/waters";
import {
  chooseHook,
  chooseChum,
  tune,
  checkLoadout,
  consumeLoadout,
  resupply,
} from "../features/tackle";
import { prepareCast, tickSession, strike } from "../features/fishing";
import { landCatch, releaseCatch } from "../features/collection";
import { claimReward } from "../features/challenges";
import { remainingRatio } from "../features/scent/lib/core";

export function gameReducer(state: Workspace, c: Command): Workspace {
  const { doc, session: s } = state;
  const busy = isBusy(s);
  switch (c.type) {
    case "spot":
      return busy ? state : { ...state, doc: selectWater(doc, c.id) };
    case "hook":
      return busy ? state : { ...state, doc: chooseHook(doc, c.id) };
    case "chum":
      return busy ? state : { ...state, doc: chooseChum(doc, c.id) };
    case "power":
      return { ...state, doc: tune(doc, "power", c.value) };
    case "drag":
      return busy ? state : { ...state, doc: tune(doc, "drag", c.value) };
    case "resupply":
      return busy
        ? state
        : {
            ...state,
            doc: resupply(doc),
            notice: "鱼饵与窝料已补给，带上好心情出发。",
          };
    case "clear-field":
      return busy
        ? state
        : {
            ...state,
            doc: {
              ...doc,
              chumField: doc.chumField.filter((p) => p.spot !== doc.spot),
            },
            notice: "本水域的窝点已清空，其他水域的窝料仍按同一时间推进。",
          };
    case "charge-start": {
      if (s.phase !== "ready") return state;
      const check = checkLoadout(doc);
      if (!check.ok)
        return {
          ...state,
          notice:
            "整组饵料不齐：钩饵或诱窝缺货，本次不会扣任何一项。",
        };
      return {
        ...state,
        session: {
          ...idleSession(),
          phase: "charging",
          hook: doc.hook,
          chum: doc.chum,
          message: "再次点击抛竿；取消则不会投放诱窝。",
        },
      };
    }
    case "charge-cancel":
      return s.phase === "charging"
        ? {
            ...state,
            session: {
              ...idleSession(),
              message: "已收竿，未投放诱窝，也未消耗饵料。",
            },
          }
        : state;
    case "cast": {
      if (s.phase !== "charging") return state;
      const consumed = consumeLoadout(doc);
      if (!consumed)
        return {
          ...state,
          session: idleSession(),
          notice: "整组饵料不齐，本次抛竿已取消，未扣任何一项。",
        };
      const at = doc.clock;
      const cast = prepareCast(
        consumed,
        s.charge,
        doc.hook,
        doc.chum,
        at,
      );
      const field = cast.portion
        ? [...consumed.chumField, cast.portion]
        : consumed.chumField;
      return {
        ...state,
        doc: {
          ...consumed,
          seed: cast.seed,
          chumField: field,
          lastDrop: { spot: doc.spot, zone: cast.session.zone },
          stats: { ...doc.stats, casts: doc.stats.casts + 1 },
        },
        session: cast.session,
      };
    }
    case "strike":
      return { ...state, session: strike(s) };
    case "reel":
      return s.phase === "fighting"
        ? { ...state, session: { ...s, reeling: c.held } }
        : state;
    case "tick": {
      const dt = Math.min(0.1, Math.max(0, c.dt));
      const at = doc.clock + dt;
      const next = tickSession(s, doc, dt, at);
      const pruned = doc.chumField.filter(
        (p) => remainingRatio(p, at) > 0,
      );
      let updated = { ...doc, clock: at, chumField: pruned };
      if (next.phase === "landed" && s.phase !== "landed")
        updated = landCatch(updated, next, Date.now());
      if (next.phase === "escaped" && s.phase !== "escaped")
        updated = {
          ...updated,
          stats: { ...updated.stats, escapes: updated.stats.escapes + 1 },
        };
      if (next === s && pruned.length === doc.chumField.length)
        return { ...state, doc: { ...doc, clock: at } };
      return { ...state, doc: updated, session: next };
    }
    case "next":
      return s.phase === "landed" || s.phase === "escaped"
        ? { ...state, session: idleSession() }
        : state;
    case "release":
      return { ...state, doc: releaseCatch(doc, c.id) };
    case "claim":
      return { ...state, doc: claimReward(doc, c.id) };
  }
}
