import { CSSProperties, useMemo } from "react";
import { GRIDLINES_BRIGHT, GRIDLINES_DIM } from "../mask-constants";

interface GridlinesOption {
  label: string;
  value: number;
}

const GRIDLINES_DIM_OPTION: GridlinesOption = { label: "dim", value: GRIDLINES_DIM };
const GRIDLINES_BRIGHT_OPTION: GridlinesOption = { label: "bright", value: GRIDLINES_BRIGHT };

export const GRIDLINES_OPTIONS: readonly GridlinesOption[] = [
  { label: "off", value: 0 },
  GRIDLINES_DIM_OPTION,
  GRIDLINES_BRIGHT_OPTION,
];

export const GRIDLINES_LEVEL_OPTIONS: readonly GridlinesOption[] = [GRIDLINES_DIM_OPTION, GRIDLINES_BRIGHT_OPTION];

interface GridlinesProps {
  value: number;
  onChange: (value: number) => void;
  segmentStyle: CSSProperties;
  options?: readonly GridlinesOption[];
  disabled?: boolean;
  title?: string;
}

export default function Gridlines({
  value,
  onChange,
  segmentStyle,
  options = GRIDLINES_OPTIONS,
  disabled = false,
  title,
}: GridlinesProps) {
  const selected = useMemo(
    () =>
      options.reduce((closest, option) =>
        Math.abs(option.value - value) < Math.abs(closest.value - value) ? option : closest,
      ).value,
    [options, value],
  );

  return (
    <>
      <span title={title} style={{ opacity: disabled ? 0.3 : 1, userSelect: "none" }}>
        {"gridlines"}
      </span>
      <div style={{ display: "flex", alignItems: "center", letterSpacing: 2 }}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <span
              key={option.label}
              onClick={() => {
                if (disabled) return;
                onChange(option.value);
              }}
              style={{
                cursor: disabled ? "default" : "pointer",
                color: isSelected ? "inherit" : "rgb(67,67,67)",
                opacity: disabled ? 0.3 : 1,
                textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                padding: "4px 8px",
                userSelect: "none",
                ...segmentStyle,
              }}
            >
              {option.label}
            </span>
          );
        })}
      </div>
    </>
  );
}
