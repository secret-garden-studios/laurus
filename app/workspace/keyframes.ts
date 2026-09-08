export interface KeyframeChainEntry {
  key: string;
  start: number;
  end: number;
}

export type KeyframeMode = "hold" | "ramp";

export type KeyframePlan =
  | { kind: "resting" }
  | { kind: "retarget"; key: string }
  | { kind: "append"; start: number; end: number; time: number };

const TIME_EPSILON = 1e-6;

function sameTime(a: number, b: number): boolean {
  return Math.abs(a - b) <= TIME_EPSILON;
}

export function keyframeChain(entries: KeyframeChainEntry[]): KeyframeChainEntry[] {
  return [...entries].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function planKeyframe(
  entries: KeyframeChainEntry[],
  timeSeconds: number,
  timelineEnd: number,
  mode: KeyframeMode,
): KeyframePlan {
  if (timeSeconds <= TIME_EPSILON) return { kind: "resting" };

  const chain = keyframeChain(entries);
  const atKeyframe = chain.find((entry) => sameTime(entry.start, timeSeconds));
  if (atKeyframe) return { kind: "retarget", key: atKeyframe.key };

  if (mode === "hold") {
    return { kind: "append", start: timeSeconds, end: Math.max(timelineEnd, timeSeconds), time: 0 };
  }
  return { kind: "append", start: 0, end: timeSeconds, time: timeSeconds * 1000 };
}

export function reindexByStart<T extends { start: number; order: number }>(units: T[]): T[] {
  const orders = units.map((unit) => unit.order).sort((a, b) => a - b);
  return [...units]
    .sort((a, b) => a.start - b.start || a.order - b.order)
    .map((unit, index) => ({ ...unit, order: orders[index] }));
}
