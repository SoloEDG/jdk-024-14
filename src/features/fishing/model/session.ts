import type { Session, GameDocument, FishId } from "../../../shared/types";
import { clamp } from "../../../shared/random";
import { fightStep } from "../lib/physics";
import { advanceWaiting, freezeBite } from "../lib/encounter";

/**
 * Advance one simulation step. `at` is the shared game clock, so every water
 * (and every deposit in it) ages by the same amount wherever the player is.
 */
export function tickSession(
  s: Session,
  doc: GameDocument,
  dt: number,
  at: number,
): Session {
  if (s.phase === "charging")
    return {
      ...s,
      clock: s.clock + dt,
      charge: clamp((Math.sin((s.clock + dt) * 2.2 - Math.PI / 2) + 1) / 2),
    };
  if (s.phase === "waiting") {
    const result = advanceWaiting(s, doc, at, dt);
    if (result.biter)
      return freezeBite(result.session, doc, at, result.biter as FishId);
    return result.session;
  }
  if (s.phase === "bite") {
    const clock = s.clock + dt;
    return clock > 4
      ? {
          ...s,
          clock,
          phase: "escaped",
          message: "错过了咬钩时机，留心浮漂，再来一次。",
        }
      : { ...s, clock };
  }
  if (s.phase === "fighting" && s.fish) return fightStep(s, doc, dt);
  return s;
}

export function strike(s: Session): Session {
  return s.phase === "bite"
    ? {
        ...s,
        phase: "fighting",
        clock: 0,
        message: "按住收线；张力过高时松开，让鱼线歇一歇。",
      }
    : s;
}
