"use client";
import { CSSProperties, useCallback, useContext, useRef, useState } from "react";
import { dellaRespira, ubuntuMono } from "../fonts";
import { MetricsContext } from "./metrics.client";

export const VIZ = {
  surface: "rgba(31, 31, 31, 1)",
  panel: "rgba(31, 31, 31, 1)",
  hairline: "rgba(255, 255, 255, 0.1)",
  primaryInk: "rgba(237, 237, 237, 1)",
  secondaryInk: "rgba(195, 194, 183, 1)",
  mutedInk: "rgba(137, 135, 129, 1)",
  grid: "rgba(255, 255, 255, 0.07)",
  axis: "rgba(255, 255, 255, 0.16)",
  crosshair: "rgba(255, 255, 255, 0.22)",
  selected: "rgba(255, 255, 255, 0.25)",
  selectedFill: "rgba(255, 255, 255, 0.08)",
  rowline: "rgba(255, 255, 255, 0.04)",
  tooltip: "rgba(12, 12, 12, 0.96)",
  returning: "#3987e5",
  fresh: "#d95926",
  ramp: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
  emptyCell: "rgba(255, 255, 255, 0.04)",
  cellInkDark: "#0b0b0b",
  cellInkLight: "rgba(255, 255, 255, 0.96)",
  good: "#0ca30c",
  critical: "#d03b3b",
} as const;

export function formatCount(value: number): string {
  if (!isFinite(value)) return "0";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
  if (Math.abs(rounded) >= 10_000) return `${(rounded / 1_000).toFixed(1)}K`;
  return rounded.toLocaleString("en-US");
}

export function formatPercent(value: number, digits: number = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

export function formatDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const step = Math.max(1, candidates.find((c) => c >= rawStep) ?? candidates[candidates.length - 1]);
  const steps = Math.max(1, Math.ceil(max / step - 0.000001));
  const ticks: number[] = [];
  for (let index = 0; index <= steps; index++) ticks.push(Number((index * step).toPrecision(12)));
  return ticks;
}

function roundedTopPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

interface Panel {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: CSSProperties;
}
export function Panel({ title, subtitle, right, children, style }: Panel) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { borderRadius: 8, padding: 20, gap: 14, borderWidth: 1 },
          header: { gap: 14, stackGap: 3 },
          title: { fontSize: 15, letterSpacing: 1 },
          subtitle: { fontSize: 11 },
        };
      case "midhigh":
        return {
          container: { borderRadius: 6, padding: 16, gap: 12, borderWidth: 1 },
          header: { gap: 12, stackGap: 2 },
          title: { fontSize: 13, letterSpacing: 1 },
          subtitle: { fontSize: 10 },
        };
      case "low":
      case "midlow":
        return {
          container: { borderRadius: 6, padding: 13, gap: 10, borderWidth: 1 },
          header: { gap: 10, stackGap: 2 },
          title: { fontSize: 12, letterSpacing: 1 },
          subtitle: { fontSize: 9 },
        };
    }
  });

  return (
    <section
      style={{
        background: VIZ.panel,
        border: `${dynamicSizes.container.borderWidth}px solid ${VIZ.hairline}`,
        borderRadius: dynamicSizes.container.borderRadius,
        padding: dynamicSizes.container.padding,
        display: "grid",
        gridTemplateRows: "min-content 1fr",
        gap: dynamicSizes.container.gap,
        minWidth: 0,
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: dynamicSizes.header.gap,
        }}
      >
        <div style={{ display: "grid", gap: dynamicSizes.header.stackGap, minWidth: 0 }}>
          <h2
            className={dellaRespira.className}
            style={{
              fontSize: dynamicSizes.title.fontSize,
              fontWeight: 400,
              letterSpacing: dynamicSizes.title.letterSpacing,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={dellaRespira.className}
              style={{ fontSize: dynamicSizes.subtitle.fontSize, color: VIZ.mutedInk }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </header>
      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}

interface ViewToggle {
  view: "chart" | "table";
  onChange: (view: "chart" | "table") => void;
}
export function ViewToggle({ view, onChange }: ViewToggle) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 3 },
          button: { fontSize: 11, letterSpacing: 1, paddingY: 4, paddingX: 10, borderRadius: 5, borderWidth: 1 },
        };
      case "midhigh":
        return {
          container: { gap: 2 },
          button: { fontSize: 10, letterSpacing: 1, paddingY: 3, paddingX: 8, borderRadius: 4, borderWidth: 1 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 2 },
          button: { fontSize: 9, letterSpacing: 1, paddingY: 3, paddingX: 7, borderRadius: 4, borderWidth: 1 },
        };
    }
  });

  return (
    <div style={{ display: "flex", gap: dynamicSizes.container.gap, flexShrink: 0 }}>
      {(["chart", "table"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={view === option}
          className={dellaRespira.className}
          style={{
            appearance: "none",
            cursor: "pointer",
            fontSize: dynamicSizes.button.fontSize,
            letterSpacing: dynamicSizes.button.letterSpacing,
            padding: `${dynamicSizes.button.paddingY}px ${dynamicSizes.button.paddingX}px`,
            borderRadius: dynamicSizes.button.borderRadius,
            border: `${dynamicSizes.button.borderWidth}px solid ${view === option ? VIZ.selected : "transparent"}`,
            background: view === option ? VIZ.selectedFill : "transparent",
            color: view === option ? VIZ.primaryInk : VIZ.mutedInk,
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

interface LegendSwatch {
  color: string;
  label: string;
}
export function LegendSwatch({ color, label }: LegendSwatch) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { container: { gap: 7 }, swatch: { size: 11, borderRadius: 2 }, label: { fontSize: 11 } };
      case "midhigh":
        return { container: { gap: 6 }, swatch: { size: 10, borderRadius: 2 }, label: { fontSize: 10 } };
      case "low":
      case "midlow":
        return { container: { gap: 5 }, swatch: { size: 9, borderRadius: 2 }, label: { fontSize: 9 } };
    }
  });

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: dynamicSizes.container.gap }}>
      <span
        style={{
          width: dynamicSizes.swatch.size,
          height: dynamicSizes.swatch.size,
          borderRadius: dynamicSizes.swatch.borderRadius,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        className={dellaRespira.className}
        style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.secondaryInk }}
      >
        {label}
      </span>
    </span>
  );
}

interface Sparkline {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}
export function Sparkline({ points, color, width, height }: Sparkline) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { width: 110, height: 30, strokeWidth: 2, dotRadius: 3.5, ringWidth: 2, inset: 2 };
      case "midhigh":
        return { width: 96, height: 26, strokeWidth: 2, dotRadius: 3, ringWidth: 2, inset: 2 };
      case "low":
      case "midlow":
        return { width: 84, height: 24, strokeWidth: 2, dotRadius: 3, ringWidth: 2, inset: 2 };
    }
  });

  const boxWidth = width ?? dynamicSizes.width;
  const boxHeight = height ?? dynamicSizes.height;
  if (points.length < 2) return <div style={{ width: boxWidth, height: boxHeight }} />;

  const max = Math.max(...points, 1);
  const stepX = boxWidth / (points.length - 1);
  const coords = points.map((value, index) => ({
    x: index * stepX,
    y: boxHeight - dynamicSizes.inset - (value / max) * (boxHeight - dynamicSizes.inset * 2),
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const last = coords[coords.length - 1];
  const tailStart = coords[Math.max(0, coords.length - 2)];

  return (
    <svg
      width={boxWidth}
      height={boxHeight}
      viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        fill="none"
        stroke={VIZ.mutedInk}
        strokeWidth={dynamicSizes.strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={`M${tailStart.x.toFixed(2)},${tailStart.y.toFixed(2)} L${last.x.toFixed(2)},${last.y.toFixed(2)}`}
        fill="none"
        stroke={color}
        strokeWidth={dynamicSizes.strokeWidth}
        strokeLinecap="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={dynamicSizes.dotRadius}
        fill={color}
        stroke={VIZ.surface}
        strokeWidth={dynamicSizes.ringWidth}
      />
    </svg>
  );
}

interface Delta {
  current: number;
  previous: number;
  higherIsBetter?: boolean;
  format?: (value: number) => string;
}
export function DeltaBadge({ current, previous, higherIsBetter = true, format = formatCount }: Delta) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { fontSize: 11, gap: 5 };
      case "midhigh":
        return { fontSize: 10, gap: 4 };
      case "low":
      case "midlow":
        return { fontSize: 9, gap: 4 };
    }
  });

  if (previous === 0) {
    return (
      <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.fontSize, color: VIZ.mutedInk }}>
        {current === 0 ? "no change" : "new"}
      </span>
    );
  }

  const change = (current - previous) / Math.abs(previous);
  const rising = change > 0;
  const flat = Math.abs(change) < 0.005;
  const positive = higherIsBetter ? rising : !rising;
  const color = flat ? VIZ.mutedInk : positive ? VIZ.good : VIZ.critical;
  const arrow = flat ? "→" : rising ? "↑" : "↓";

  return (
    <span
      className={dellaRespira.className}
      style={{
        fontSize: dynamicSizes.fontSize,
        color,
        display: "inline-flex",
        alignItems: "center",
        gap: dynamicSizes.gap,
      }}
      title={`${format(previous)} in the preceding period`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{flat ? "flat" : formatPercent(Math.abs(change), 0)}</span>
      <span style={{ color: VIZ.mutedInk }}>vs prev</span>
    </span>
  );
}

interface StatTile {
  label: string;
  value: string;
  hero?: boolean;
  delta?: Delta;
  trend?: number[];
  trendColor?: string;
  footnote?: string;
}
export function StatTile({ label, value, hero, delta, trend, trendColor, footnote }: StatTile) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: {
            borderRadius: 8,
            gap: 7,
            borderWidth: 1,
            heroPaddingY: 20,
            heroPaddingX: 22,
            paddingY: 14,
            paddingX: 16,
          },
          label: { fontSize: 11, letterSpacing: 1 },
          value: { heroFontSize: 56, fontSize: 28, gap: 12 },
          footnote: { fontSize: 11 },
          spark: { heroWidth: 150, heroHeight: 38, width: 96, height: 26 },
        };
      case "midhigh":
        return {
          container: {
            borderRadius: 6,
            gap: 6,
            borderWidth: 1,
            heroPaddingY: 16,
            heroPaddingX: 18,
            paddingY: 12,
            paddingX: 14,
          },
          label: { fontSize: 10, letterSpacing: 1 },
          value: { heroFontSize: 48, fontSize: 24, gap: 10 },
          footnote: { fontSize: 10 },
          spark: { heroWidth: 132, heroHeight: 34, width: 84, height: 24 },
        };
      case "low":
      case "midlow":
        return {
          container: {
            borderRadius: 6,
            gap: 5,
            borderWidth: 1,
            heroPaddingY: 13,
            heroPaddingX: 15,
            paddingY: 10,
            paddingX: 12,
          },
          label: { fontSize: 9, letterSpacing: 1 },
          value: { heroFontSize: 40, fontSize: 20, gap: 9 },
          footnote: { fontSize: 9 },
          spark: { heroWidth: 112, heroHeight: 30, width: 72, height: 22 },
        };
    }
  });

  const paddingY = hero ? dynamicSizes.container.heroPaddingY : dynamicSizes.container.paddingY;
  const paddingX = hero ? dynamicSizes.container.heroPaddingX : dynamicSizes.container.paddingX;

  return (
    <div
      style={{
        background: VIZ.panel,
        border: `${dynamicSizes.container.borderWidth}px solid ${VIZ.hairline}`,
        borderRadius: dynamicSizes.container.borderRadius,
        padding: `${paddingY}px ${paddingX}px`,
        display: "grid",
        gap: dynamicSizes.container.gap,
        alignContent: "start",
        minWidth: 0,
      }}
    >
      <div
        className={dellaRespira.className}
        style={{
          fontSize: dynamicSizes.label.fontSize,
          letterSpacing: dynamicSizes.label.letterSpacing,
          color: VIZ.mutedInk,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: dynamicSizes.value.gap,
        }}
      >
        <div
          className={dellaRespira.className}
          style={{
            fontSize: hero ? dynamicSizes.value.heroFontSize : dynamicSizes.value.fontSize,
            lineHeight: 1,
            color: VIZ.primaryInk,
          }}
        >
          {value}
        </div>
        {trend && trend.length > 1 && (
          <Sparkline
            points={trend}
            color={trendColor ?? VIZ.returning}
            width={hero ? dynamicSizes.spark.heroWidth : dynamicSizes.spark.width}
            height={hero ? dynamicSizes.spark.heroHeight : dynamicSizes.spark.height}
          />
        )}
      </div>
      {delta && <DeltaBadge {...delta} />}
      {footnote && (
        <div
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.footnote.fontSize, color: VIZ.mutedInk }}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}

export function useMeasuredWidth(fallback: number): [(node: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      setWidth(node.clientWidth || fallback);
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        const measured = entries[0]?.contentRect.width ?? 0;
        if (measured > 0) setWidth(measured);
      });
      observer.observe(node);
      observerRef.current = observer;
    },
    [fallback],
  );

  return [ref, width];
}

interface VisitorsChart {
  series: { day: string; new_visitors: number; returning_visitors: number; unique_visitors: number }[];
}
export function VisitorsChart({ series }: VisitorsChart) {
  const { resolution } = useContext(MetricsContext);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 14 },
          header: { gap: 14 },
          legend: { gap: 18 },
          plot: {
            paddingTop: 20,
            paddingRight: 14,
            paddingBottom: 30,
            paddingLeft: 52,
            height: 230,
            minWidth: 320,
            fallbackWidth: 900,
          },
          bar: { max: 28, ratio: 0.62, min: 2, radius: 4, segmentGap: 2 },
          grid: { strokeWidth: 1, tickCount: 4 },
          axis: { fontSize: 10, labelOffset: 10, baselineOffset: 3, xOffset: 19, labelSlots: 6 },
          peak: { fontSize: 10, offset: 7 },
          crosshair: { strokeWidth: 1 },
          tooltip: { width: 168, borderRadius: 5, paddingY: 9, paddingX: 11, gap: 5, fontSize: 11, borderWidth: 1 },
        };
      case "midhigh":
        return {
          container: { gap: 10 },
          header: { gap: 12 },
          legend: { gap: 14 },
          plot: {
            paddingTop: 18,
            paddingRight: 12,
            paddingBottom: 26,
            paddingLeft: 44,
            height: 190,
            minWidth: 280,
            fallbackWidth: 720,
          },
          bar: { max: 24, ratio: 0.62, min: 2, radius: 4, segmentGap: 2 },
          grid: { strokeWidth: 1, tickCount: 4 },
          axis: { fontSize: 9, labelOffset: 8, baselineOffset: 3, xOffset: 16, labelSlots: 6 },
          peak: { fontSize: 9, offset: 6 },
          crosshair: { strokeWidth: 1 },
          tooltip: { width: 140, borderRadius: 4, paddingY: 8, paddingX: 10, gap: 4, fontSize: 10, borderWidth: 1 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 9 },
          header: { gap: 10 },
          legend: { gap: 12 },
          plot: {
            paddingTop: 16,
            paddingRight: 10,
            paddingBottom: 24,
            paddingLeft: 38,
            height: 165,
            minWidth: 260,
            fallbackWidth: 640,
          },
          bar: { max: 20, ratio: 0.62, min: 2, radius: 3, segmentGap: 2 },
          grid: { strokeWidth: 1, tickCount: 4 },
          axis: { fontSize: 9, labelOffset: 7, baselineOffset: 3, xOffset: 15, labelSlots: 5 },
          peak: { fontSize: 9, offset: 6 },
          crosshair: { strokeWidth: 1 },
          tooltip: { width: 132, borderRadius: 4, paddingY: 7, paddingX: 9, gap: 4, fontSize: 9, borderWidth: 1 },
        };
    }
  });

  const [containerRef, containerWidth] = useMeasuredWidth(dynamicSizes.plot.fallbackWidth);

  const width = Math.max(containerWidth, dynamicSizes.plot.minWidth);
  const plotWidth = Math.max(width - dynamicSizes.plot.paddingLeft - dynamicSizes.plot.paddingRight, 40);
  const plotHeight = dynamicSizes.plot.height;
  const height = plotHeight + dynamicSizes.plot.paddingTop + dynamicSizes.plot.paddingBottom;

  const max = Math.max(...series.map((p) => p.unique_visitors), 1);
  const ticks = niceTicks(max, dynamicSizes.grid.tickCount);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const band = plotWidth / Math.max(series.length, 1);
  const barWidth = Math.max(dynamicSizes.bar.min, Math.min(dynamicSizes.bar.max, band * dynamicSizes.bar.ratio));
  const toY = (value: number) => dynamicSizes.plot.paddingTop + plotHeight - (value / scaleMax) * plotHeight;
  const peakIndex = series.reduce(
    (best, point, index) => (point.unique_visitors > (series[best]?.unique_visitors ?? -1) ? index : best),
    0,
  );
  const labelEvery = Math.max(1, Math.ceil(series.length / dynamicSizes.axis.labelSlots));
  const active = hovered !== undefined ? series[hovered] : undefined;

  if (view === "table") {
    return (
      <div style={{ display: "grid", gap: dynamicSizes.container.gap, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <DataTable
          columns={["Day", "Returning", "New", "Unique visitors"]}
          rows={series.map((p) => [
            formatDay(p.day),
            formatCount(p.returning_visitors),
            formatCount(p.new_visitors),
            formatCount(p.unique_visitors),
          ])}
          numericFrom={1}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: dynamicSizes.header.gap,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", gap: dynamicSizes.legend.gap, flexWrap: "wrap", minWidth: 0 }}>
          <LegendSwatch color={VIZ.returning} label="returning" />
          <LegendSwatch color={VIZ.fresh} label="new" />
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0, overflowX: "auto" }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Unique visitors per day, split into returning and new"
          onMouseLeave={() => setHovered(undefined)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={dynamicSizes.plot.paddingLeft}
                x2={dynamicSizes.plot.paddingLeft + plotWidth}
                y1={toY(tick)}
                y2={toY(tick)}
                stroke={tick === 0 ? VIZ.axis : VIZ.grid}
                strokeWidth={dynamicSizes.grid.strokeWidth}
                shapeRendering="crispEdges"
              />
              <text
                x={dynamicSizes.plot.paddingLeft - dynamicSizes.axis.labelOffset}
                y={toY(tick) + dynamicSizes.axis.baselineOffset}
                textAnchor="end"
                className={ubuntuMono.className}
                style={{ fontSize: dynamicSizes.axis.fontSize, fill: VIZ.mutedInk, fontVariantNumeric: "tabular-nums" }}
              >
                {formatCount(tick)}
              </text>
            </g>
          ))}

          {series.map((point, index) => {
            const centre = dynamicSizes.plot.paddingLeft + index * band + band / 2;
            const x = centre - barWidth / 2;
            const baseline = dynamicSizes.plot.paddingTop + plotHeight;
            const returningHeight = (point.returning_visitors / scaleMax) * plotHeight;
            const newHeight = (point.new_visitors / scaleMax) * plotHeight;
            const gap = returningHeight > 0 && newHeight > 0 ? dynamicSizes.bar.segmentGap : 0;
            const returningY = baseline - returningHeight;
            const newY = returningY - gap - newHeight;
            const topIsNew = newHeight > 0;
            return (
              <g key={point.day}>
                {returningHeight > 0 &&
                  (topIsNew ? (
                    <rect x={x} y={returningY} width={barWidth} height={returningHeight} fill={VIZ.returning} />
                  ) : (
                    <path
                      d={roundedTopPath(x, returningY, barWidth, returningHeight, dynamicSizes.bar.radius)}
                      fill={VIZ.returning}
                    />
                  ))}
                {newHeight > 0 && (
                  <path d={roundedTopPath(x, newY, barWidth, newHeight, dynamicSizes.bar.radius)} fill={VIZ.fresh} />
                )}
                <rect
                  x={dynamicSizes.plot.paddingLeft + index * band}
                  y={dynamicSizes.plot.paddingTop}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
              </g>
            );
          })}

          {series.length > 0 && series[peakIndex].unique_visitors > 0 && (
            <text
              x={dynamicSizes.plot.paddingLeft + peakIndex * band + band / 2}
              y={toY(series[peakIndex].unique_visitors) - dynamicSizes.peak.offset}
              textAnchor="middle"
              className={ubuntuMono.className}
              style={{
                fontSize: dynamicSizes.peak.fontSize,
                fill: VIZ.secondaryInk,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCount(series[peakIndex].unique_visitors)}
            </text>
          )}

          {series.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={`x-${point.day}`}
                x={dynamicSizes.plot.paddingLeft + index * band + band / 2}
                y={dynamicSizes.plot.paddingTop + plotHeight + dynamicSizes.axis.xOffset}
                textAnchor="middle"
                className={ubuntuMono.className}
                style={{ fontSize: dynamicSizes.axis.fontSize, fill: VIZ.mutedInk }}
              >
                {formatDay(point.day)}
              </text>
            ) : null,
          )}

          {hovered !== undefined && (
            <line
              x1={dynamicSizes.plot.paddingLeft + hovered * band + band / 2}
              x2={dynamicSizes.plot.paddingLeft + hovered * band + band / 2}
              y1={dynamicSizes.plot.paddingTop}
              y2={dynamicSizes.plot.paddingTop + plotHeight}
              stroke={VIZ.crosshair}
              strokeWidth={dynamicSizes.crosshair.strokeWidth}
              shapeRendering="crispEdges"
            />
          )}
        </svg>

        {active && (
          <div
            style={{
              position: "absolute",
              left: Math.min(
                Math.max(
                  dynamicSizes.plot.paddingLeft + (hovered ?? 0) * band + band / 2 - dynamicSizes.tooltip.width / 2,
                  0,
                ),
                Math.max(width - dynamicSizes.tooltip.width, 0),
              ),
              top: 0,
              width: dynamicSizes.tooltip.width,
              pointerEvents: "none",
              background: VIZ.tooltip,
              border: `${dynamicSizes.tooltip.borderWidth}px solid ${VIZ.hairline}`,
              borderRadius: dynamicSizes.tooltip.borderRadius,
              padding: `${dynamicSizes.tooltip.paddingY}px ${dynamicSizes.tooltip.paddingX}px`,
              display: "grid",
              gap: dynamicSizes.tooltip.gap,
            }}
          >
            <div
              className={dellaRespira.className}
              style={{ fontSize: dynamicSizes.tooltip.fontSize, color: VIZ.primaryInk }}
            >
              {formatDay(active.day)}
            </div>
            <TooltipRow color={VIZ.returning} label="returning" value={formatCount(active.returning_visitors)} />
            <TooltipRow color={VIZ.fresh} label="new" value={formatCount(active.new_visitors)} />
            <TooltipRow label="unique" value={formatCount(active.unique_visitors)} />
          </div>
        )}
      </div>
    </div>
  );
}

interface TooltipRow {
  color?: string;
  label: string;
  value: string;
}
function TooltipRow({ color, label, value }: TooltipRow) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { container: { gap: 12 }, swatch: { size: 9, borderRadius: 2, gap: 7 }, text: { fontSize: 11 } };
      case "midhigh":
        return { container: { gap: 10 }, swatch: { size: 8, borderRadius: 2, gap: 6 }, text: { fontSize: 10 } };
      case "low":
      case "midlow":
        return { container: { gap: 9 }, swatch: { size: 8, borderRadius: 2, gap: 5 }, text: { fontSize: 9 } };
    }
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: dynamicSizes.container.gap,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: dynamicSizes.swatch.gap }}>
        {color ? (
          <span
            style={{
              width: dynamicSizes.swatch.size,
              height: dynamicSizes.swatch.size,
              borderRadius: dynamicSizes.swatch.borderRadius,
              background: color,
            }}
          />
        ) : (
          <span style={{ width: dynamicSizes.swatch.size }} />
        )}
        <span
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.text.fontSize, color: VIZ.secondaryInk }}
        >
          {label}
        </span>
      </span>
      <span
        className={ubuntuMono.className}
        style={{ fontSize: dynamicSizes.text.fontSize, color: VIZ.primaryInk, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

interface DataTable {
  columns: string[];
  rows: (string | number)[][];
  numericFrom?: number;
  emptyMessage?: string;
}
export function DataTable({ columns, rows, numericFrom = 1, emptyMessage = "No data in this range." }: DataTable) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { maxHeight: 380 },
          head: { fontSize: 11, letterSpacing: 1, paddingY: 7, paddingRight: 12, borderWidth: 1 },
          cell: { fontSize: 12, paddingY: 7, paddingRight: 12, maxWidth: 300, borderWidth: 1 },
          empty: { fontSize: 12, paddingY: 9 },
        };
      case "midhigh":
        return {
          container: { maxHeight: 320 },
          head: { fontSize: 10, letterSpacing: 1, paddingY: 6, paddingRight: 10, borderWidth: 1 },
          cell: { fontSize: 11, paddingY: 6, paddingRight: 10, maxWidth: 260, borderWidth: 1 },
          empty: { fontSize: 11, paddingY: 8 },
        };
      case "low":
      case "midlow":
        return {
          container: { maxHeight: 280 },
          head: { fontSize: 9, letterSpacing: 1, paddingY: 5, paddingRight: 9, borderWidth: 1 },
          cell: { fontSize: 10, paddingY: 5, paddingRight: 9, maxWidth: 220, borderWidth: 1 },
          empty: { fontSize: 10, paddingY: 7 },
        };
    }
  });

  if (rows.length === 0) {
    return (
      <p
        className={dellaRespira.className}
        style={{
          fontSize: dynamicSizes.empty.fontSize,
          color: VIZ.mutedInk,
          padding: `${dynamicSizes.empty.paddingY}px 0`,
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto", maxHeight: dynamicSizes.container.maxHeight, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={dellaRespira.className}
                style={{
                  textAlign: index >= numericFrom ? "right" : "left",
                  fontSize: dynamicSizes.head.fontSize,
                  fontWeight: 400,
                  letterSpacing: dynamicSizes.head.letterSpacing,
                  color: VIZ.mutedInk,
                  padding: `${dynamicSizes.head.paddingY}px ${dynamicSizes.head.paddingRight}px ${dynamicSizes.head.paddingY}px 0`,
                  borderBottom: `${dynamicSizes.head.borderWidth}px solid ${VIZ.hairline}`,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  background: VIZ.panel,
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cellIndex >= numericFrom ? ubuntuMono.className : dellaRespira.className}
                  style={{
                    textAlign: cellIndex >= numericFrom ? "right" : "left",
                    fontSize: dynamicSizes.cell.fontSize,
                    color: cellIndex === 0 ? VIZ.primaryInk : VIZ.secondaryInk,
                    padding: `${dynamicSizes.cell.paddingY}px ${dynamicSizes.cell.paddingRight}px ${dynamicSizes.cell.paddingY}px 0`,
                    borderBottom: `${dynamicSizes.cell.borderWidth}px solid ${VIZ.rowline}`,
                    fontVariantNumeric: cellIndex >= numericFrom ? "tabular-nums" : "normal",
                    whiteSpace: "nowrap",
                    maxWidth: dynamicSizes.cell.maxWidth,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={String(cell)}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rampIndex(ratio: number): number {
  if (ratio <= 0) return -1;
  const index = Math.floor(ratio * VIZ.ramp.length);
  return Math.max(0, Math.min(VIZ.ramp.length - 1, index));
}

function cellInk(index: number): string {
  return index >= 2 ? VIZ.cellInkDark : VIZ.cellInkLight;
}

interface RetentionGrid {
  cohorts: { cohort_week: string; size: number; weeks: number[] }[];
  weeks: number;
}
export function RetentionGrid({ cohorts, weeks }: RetentionGrid) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 14 },
          table: { borderSpacing: 3 },
          head: { fontSize: 11, paddingRight: 10, paddingBottom: 5, weekFontSize: 10, weekMinWidth: 50 },
          row: { fontSize: 11, paddingRight: 10 },
          cell: { fontSize: 11, paddingY: 7, paddingX: 5, borderRadius: 4 },
          legend: { gap: 9, swatchWidth: 30, swatchHeight: 9, swatchGap: 2, borderRadius: 2, fontSize: 11 },
          empty: { fontSize: 12 },
        };
      case "midhigh":
        return {
          container: { gap: 12 },
          table: { borderSpacing: 2 },
          head: { fontSize: 10, paddingRight: 8, paddingBottom: 4, weekFontSize: 9, weekMinWidth: 44 },
          row: { fontSize: 10, paddingRight: 8 },
          cell: { fontSize: 10, paddingY: 6, paddingX: 4, borderRadius: 3 },
          legend: { gap: 8, swatchWidth: 26, swatchHeight: 8, swatchGap: 2, borderRadius: 2, fontSize: 10 },
          empty: { fontSize: 11 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 10 },
          table: { borderSpacing: 2 },
          head: { fontSize: 9, paddingRight: 7, paddingBottom: 4, weekFontSize: 8, weekMinWidth: 38 },
          row: { fontSize: 9, paddingRight: 7 },
          cell: { fontSize: 9, paddingY: 5, paddingX: 3, borderRadius: 3 },
          legend: { gap: 7, swatchWidth: 22, swatchHeight: 7, swatchGap: 2, borderRadius: 2, fontSize: 9 },
          empty: { fontSize: 10 },
        };
    }
  });

  if (cohorts.length === 0) {
    return (
      <p className={dellaRespira.className} style={{ fontSize: dynamicSizes.empty.fontSize, color: VIZ.mutedInk }}>
        No cohorts yet — retention appears once visitors have been tracked for more than a week.
      </p>
    );
  }

  const columnCount = Math.max(1, Math.min(weeks, Math.max(...cohorts.map((c) => c.weeks.length), 1)));

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: dynamicSizes.table.borderSpacing, width: "100%" }}>
          <thead>
            <tr>
              <th
                scope="col"
                className={dellaRespira.className}
                style={{
                  textAlign: "left",
                  fontSize: dynamicSizes.head.fontSize,
                  fontWeight: 400,
                  color: VIZ.mutedInk,
                  padding: `0 ${dynamicSizes.head.paddingRight}px ${dynamicSizes.head.paddingBottom}px 0`,
                }}
              >
                Cohort
              </th>
              <th
                scope="col"
                className={dellaRespira.className}
                style={{
                  textAlign: "right",
                  fontSize: dynamicSizes.head.fontSize,
                  fontWeight: 400,
                  color: VIZ.mutedInk,
                  padding: `0 ${dynamicSizes.row.paddingRight}px ${dynamicSizes.head.paddingBottom}px 0`,
                }}
              >
                Size
              </th>
              {Array.from({ length: columnCount }, (_, index) => (
                <th
                  key={index}
                  scope="col"
                  className={ubuntuMono.className}
                  style={{
                    fontSize: dynamicSizes.head.weekFontSize,
                    fontWeight: 400,
                    color: VIZ.mutedInk,
                    padding: `0 0 ${dynamicSizes.head.paddingBottom}px 0`,
                    minWidth: dynamicSizes.head.weekMinWidth,
                  }}
                >
                  {`W${index}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohort_week}>
                <th
                  scope="row"
                  className={dellaRespira.className}
                  style={{
                    textAlign: "left",
                    fontSize: dynamicSizes.row.fontSize,
                    fontWeight: 400,
                    color: VIZ.secondaryInk,
                    padding: `0 ${dynamicSizes.head.paddingRight}px 0 0`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDay(cohort.cohort_week)}
                </th>
                <td
                  className={ubuntuMono.className}
                  style={{
                    textAlign: "right",
                    fontSize: dynamicSizes.row.fontSize,
                    color: VIZ.secondaryInk,
                    padding: `0 ${dynamicSizes.row.paddingRight}px 0 0`,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cohort.size}
                </td>
                {Array.from({ length: columnCount }, (_, index) => {
                  const retained = cohort.weeks[index];
                  if (retained === undefined) {
                    return <td key={index} style={{ background: "transparent" }} />;
                  }
                  const ratio = cohort.size > 0 ? retained / cohort.size : 0;
                  const step = rampIndex(ratio);
                  return (
                    <td
                      key={index}
                      title={`${formatDay(cohort.cohort_week)} · week ${index}: ${retained} of ${cohort.size} returned`}
                      className={ubuntuMono.className}
                      style={{
                        background: step < 0 ? VIZ.emptyCell : VIZ.ramp[step],
                        color: step < 0 ? VIZ.mutedInk : cellInk(step),
                        fontSize: dynamicSizes.cell.fontSize,
                        textAlign: "center",
                        padding: `${dynamicSizes.cell.paddingY}px ${dynamicSizes.cell.paddingX}px`,
                        borderRadius: dynamicSizes.cell.borderRadius,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPercent(ratio, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: dynamicSizes.legend.gap }}>
        <span
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.legend.fontSize, color: VIZ.mutedInk }}
        >
          0%
        </span>
        <div style={{ display: "flex", gap: dynamicSizes.legend.swatchGap }}>
          {VIZ.ramp.map((step) => (
            <span
              key={step}
              style={{
                width: dynamicSizes.legend.swatchWidth,
                height: dynamicSizes.legend.swatchHeight,
                borderRadius: dynamicSizes.legend.borderRadius,
                background: step,
              }}
            />
          ))}
        </div>
        <span
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.legend.fontSize, color: VIZ.mutedInk }}
        >
          100% returned
        </span>
      </div>
    </div>
  );
}

interface RankedBars {
  rows: { label: string; value: number; secondary?: string }[];
  valueLabel: string;
  emptyMessage?: string;
  emphasis?: boolean;
}
export function RankedBars({
  rows,
  valueLabel,
  emptyMessage = "Nothing recorded in this range.",
  emphasis = false,
}: RankedBars) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 12 },
          list: { gap: 10 },
          row: { gap: 5, labelGap: 12 },
          label: { fontSize: 12 },
          secondary: { fontSize: 11, gap: 9 },
          value: { fontSize: 12 },
          bar: { height: 9, radius: 4, minPercent: 0.8 },
          caption: { fontSize: 11 },
          empty: { fontSize: 12 },
        };
      case "midhigh":
        return {
          container: { gap: 10 },
          list: { gap: 8 },
          row: { gap: 4, labelGap: 10 },
          label: { fontSize: 11 },
          secondary: { fontSize: 10, gap: 8 },
          value: { fontSize: 11 },
          bar: { height: 8, radius: 4, minPercent: 0.8 },
          caption: { fontSize: 10 },
          empty: { fontSize: 11 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 9 },
          list: { gap: 7 },
          row: { gap: 4, labelGap: 9 },
          label: { fontSize: 10 },
          secondary: { fontSize: 9, gap: 7 },
          value: { fontSize: 10 },
          bar: { height: 7, radius: 3, minPercent: 0.8 },
          caption: { fontSize: 9 },
          empty: { fontSize: 10 },
        };
    }
  });

  if (rows.length === 0) {
    return (
      <p className={dellaRespira.className} style={{ fontSize: dynamicSizes.empty.fontSize, color: VIZ.mutedInk }}>
        {emptyMessage}
      </p>
    );
  }

  const weight = emphasis
    ? {
        listGap: dynamicSizes.list.gap + 6,
        barHeight: Math.round(dynamicSizes.bar.height * 1.9),
        labelFont: dynamicSizes.label.fontSize + 1,
        valueFont: dynamicSizes.value.fontSize + 3,
      }
    : {
        listGap: dynamicSizes.list.gap,
        barHeight: dynamicSizes.bar.height,
        labelFont: dynamicSizes.label.fontSize,
        valueFont: dynamicSizes.value.fontSize,
      };

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      <div style={{ display: "grid", gap: weight.listGap }}>
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} style={{ display: "grid", gap: dynamicSizes.row.gap }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: dynamicSizes.row.labelGap,
              }}
            >
              <span
                className={dellaRespira.className}
                style={{
                  fontSize: weight.labelFont,
                  color: VIZ.primaryInk,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={row.label}
              >
                {row.label}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  gap: dynamicSizes.secondary.gap,
                  alignItems: "baseline",
                  flexShrink: 0,
                }}
              >
                {row.secondary && (
                  <span
                    className={dellaRespira.className}
                    style={{ fontSize: dynamicSizes.secondary.fontSize, color: VIZ.mutedInk }}
                  >
                    {row.secondary}
                  </span>
                )}
                <span
                  className={ubuntuMono.className}
                  style={{
                    fontSize: weight.valueFont,
                    color: emphasis ? VIZ.primaryInk : VIZ.secondaryInk,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCount(row.value)}
                </span>
              </span>
            </div>
            <div style={{ width: "100%", height: weight.barHeight }} aria-hidden="true">
              <div
                style={{
                  width: `${Math.max((row.value / max) * 100, dynamicSizes.bar.minPercent)}%`,
                  height: weight.barHeight,
                  background: VIZ.returning,
                  borderRadius: `0 ${dynamicSizes.bar.radius}px ${dynamicSizes.bar.radius}px 0`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.caption.fontSize, color: VIZ.mutedInk }}>
        {valueLabel}
      </span>
    </div>
  );
}
