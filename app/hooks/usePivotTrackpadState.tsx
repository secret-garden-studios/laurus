import { useCallback, useMemo } from "react";

export interface PivotTrackpadState {
  getPivotTrackValue: (cursor: number, trackSize: number) => number;
  getPivotTrackCursor: (value: number, trackSize: number) => number;
}

export function usePivotTrackpadState(
  offset: number,
  minValue: number,
  pivotValue: number,
  maxValue: number,
): PivotTrackpadState {
  const getContext = useCallback(
    (trackSize: number) => {
      const maxCursor = Math.max(0, trackSize - offset);
      const medianCursor = Math.ceil(maxCursor / 2);
      const leftSector = Math.max(1, medianCursor);
      const rightSector = Math.max(1, maxCursor - medianCursor);
      return { maxCursor, medianCursor, leftSector, rightSector };
    },
    [offset],
  );

  return useMemo(() => {
    const pivot = Math.max(minValue, Math.min(pivotValue, maxValue));
    return {
      getPivotTrackValue: (cursor: number, trackSize: number): number => {
        const ctx = getContext(trackSize);
        const clampedCursor = Math.max(0, Math.min(cursor, ctx.maxCursor));
        if (clampedCursor <= ctx.medianCursor) {
          return minValue + (clampedCursor / ctx.leftSector) * (pivot - minValue);
        }
        return pivot + ((clampedCursor - ctx.medianCursor) / ctx.rightSector) * (maxValue - pivot);
      },

      getPivotTrackCursor: (value: number, trackSize: number): number => {
        const ctx = getContext(trackSize);
        const safeValue = Math.max(minValue, Math.min(value, maxValue));
        let cursor: number;
        if (safeValue <= pivot) {
          const denominator = pivot - minValue;
          cursor = denominator > 0 ? ((safeValue - minValue) / denominator) * ctx.leftSector : ctx.medianCursor;
        } else {
          const denominator = maxValue - pivot;
          cursor = ctx.medianCursor + (denominator > 0 ? ((safeValue - pivot) / denominator) * ctx.rightSector : 0);
        }
        return Math.max(0, Math.min(Math.round(cursor), ctx.maxCursor));
      },
    };
  }, [getContext, minValue, pivotValue, maxValue]);
}
