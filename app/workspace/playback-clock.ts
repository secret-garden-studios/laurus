export type PlaybackKind = "play" | "fast-forward" | "rewind";

type PlaybackClockSubscriber = (elapsedMs: number, kind: PlaybackKind | null) => void;

const subscribers = new Set<PlaybackClockSubscriber>();

let frameId: number | null = null;
let startedAt = 0;
let elapsedMs = 0;
let kind: PlaybackKind | null = null;

function notify() {
  subscribers.forEach((subscriber) => subscriber(elapsedMs, kind));
}

function frame(now: number) {
  elapsedMs = now - startedAt;
  notify();
  frameId = requestAnimationFrame(frame);
}

export function startPlaybackClock(newKind: PlaybackKind) {
  if (frameId !== null) cancelAnimationFrame(frameId);
  startedAt = performance.now();
  elapsedMs = 0;
  kind = newKind;
  notify();
  frameId = requestAnimationFrame(frame);
}

export function stopPlaybackClock() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  elapsedMs = 0;
  kind = null;
  notify();
}

export function subscribeToPlaybackClock(subscriber: PlaybackClockSubscriber) {
  subscribers.add(subscriber);
  subscriber(elapsedMs, kind);
  return () => {
    subscribers.delete(subscriber);
  };
}
