const SKEW_POLE_EPSILON = 1;

export function toCssSkewAngle(deg: number): number {
  const distanceFromPole = (((deg % 180) + 180) % 180) - 90;
  if (Math.abs(distanceFromPole) >= SKEW_POLE_EPSILON) return deg;
  return distanceFromPole < 0
    ? deg - (SKEW_POLE_EPSILON + distanceFromPole)
    : deg + (SKEW_POLE_EPSILON - distanceFromPole);
}
