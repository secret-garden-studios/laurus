type PlaybackClockSubscriber = (elapsedMs: number, running: boolean) => void;

const subscribers = new Set<PlaybackClockSubscriber>();

let frameId: number | null = null;
let startedAt = 0;
let elapsedMs = 0;
let running = false;

function notify() {
  subscribers.forEach((subscriber) => subscriber(elapsedMs, running));
}

function frame(now: number) {
  elapsedMs = now - startedAt;
  notify();
  frameId = requestAnimationFrame(frame);
}

export function startPlaybackClock() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  startedAt = performance.now();
  elapsedMs = 0;
  running = true;
  notify();
  frameId = requestAnimationFrame(frame);
}

export function stopPlaybackClock() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  elapsedMs = 0;
  running = false;
  notify();
}

export function subscribeToPlaybackClock(subscriber: PlaybackClockSubscriber) {
  subscribers.add(subscriber);
  subscriber(elapsedMs, running);
  return () => {
    subscribers.delete(subscriber);
  };
}
