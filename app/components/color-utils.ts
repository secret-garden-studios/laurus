export interface LaurusRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LaurusColor extends LaurusRgba {
  h: number;
  s: number;
}

export interface LaurusHsv {
  h: number;
  s: number;
  v: number;
}

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const HUE_CEILING = 359.99;

export function normalizeHue(hue: number): number {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function rgbToHsv(r: number, g: number, b: number): LaurusHsv {
  const red = clampUnit(r);
  const green = clampUnit(g);
  const blue = clampUnit(b);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
    h = normalizeHue(h * 60);
  }

  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const saturation = clampUnit(s);
  const value = clampUnit(v);
  const chroma = value * saturation;
  const sector = normalizeHue(h) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;
  if (sector < 1) {
    [r, g, b] = [chroma, x, 0];
  } else if (sector < 2) {
    [r, g, b] = [x, chroma, 0];
  } else if (sector < 3) {
    [r, g, b] = [0, chroma, x];
  } else if (sector < 4) {
    [r, g, b] = [0, x, chroma];
  } else if (sector < 5) {
    [r, g, b] = [x, 0, chroma];
  } else {
    [r, g, b] = [chroma, 0, x];
  }

  const m = value - chroma;
  return { r: r + m, g: g + m, b: b + m };
}

const toByte = (channel: number): number => Math.round(clampUnit(channel) * 255);

export function rgbaToCss({ r, g, b, a }: LaurusRgba): string {
  return `rgba(${toByte(r)}, ${toByte(g)}, ${toByte(b)}, ${clampUnit(a).toFixed(3)})`;
}

export function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${toByte(r)}, ${toByte(g)}, ${toByte(b)})`;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => toByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbaEquals(a: LaurusRgba, b: LaurusRgba, epsilon: number = 0.0005): boolean {
  return (
    Math.abs(a.r - b.r) < epsilon &&
    Math.abs(a.g - b.g) < epsilon &&
    Math.abs(a.b - b.b) < epsilon &&
    Math.abs(a.a - b.a) < epsilon
  );
}

export function resolveHsv(color: LaurusColor): LaurusHsv {
  const derived = rgbToHsv(color.r, color.g, color.b);
  return {
    h: derived.s > 0 && derived.v > 0 ? derived.h : normalizeHue(color.h),
    s: derived.v > 0 ? derived.s : Math.max(0, Math.min(1, color.s)),
    v: derived.v,
  };
}

export function toLaurusColor(hsv: LaurusHsv, a: number): LaurusColor {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return { ...rgb, a, h: normalizeHue(hsv.h), s: Math.max(0, Math.min(1, hsv.s)) };
}
