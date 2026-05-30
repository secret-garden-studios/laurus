import { useCallback, useMemo } from 'react';

export interface ComplexTrackpadOptions {
    minValue?: number;
    fineTuningLimit?: number;
    fineTuningSegmentRatio?: number;
}

export interface ComplexTrackpadState {
    getComplexTrackValue: (cursor: number, trackWidth: number, options?: ComplexTrackpadOptions) => number;
    getComplexTrackCursor: (value: number, trackWidth: number, options?: ComplexTrackpadOptions) => number;
}

export function useComplexTrackpadState(offset: number, maxValue: number): ComplexTrackpadState {

    const getContext = useCallback((trackWidth: number) => {
        const maxCursor = Math.max(0, trackWidth - offset);
        const medianCursor = Math.ceil(maxCursor / 2);
        const leftSector = Math.max(1, medianCursor);
        const rightSector = Math.max(1, maxCursor - medianCursor);
        return { medianCursor, maxCursor, rightSector, leftSector };
    }, [offset]);

    return useMemo(() => ({
        getComplexTrackValue: (cursor: number, trackWidth: number, options: ComplexTrackpadOptions = {}): number => {
            const { minValue = 0, fineTuningLimit, fineTuningSegmentRatio = 0.5 } = options;
            const ctx = getContext(trackWidth);
            const clampedCursor = Math.max(0, Math.min(cursor, ctx.maxCursor));

            let value: number;
            if (clampedCursor <= ctx.medianCursor) {
                value = clampedCursor / ctx.leftSector;
            } else {
                if (fineTuningLimit !== undefined && fineTuningLimit > 1 && fineTuningLimit < maxValue) {
                    const ratio = Math.max(0, Math.min(1, fineTuningSegmentRatio));
                    const fineTuningWidth = Math.floor(ctx.rightSector * ratio);
                    const fineTuningCursor = ctx.medianCursor + fineTuningWidth;

                    if (clampedCursor <= fineTuningCursor) {
                        const segmentPercentage = (clampedCursor - ctx.medianCursor) / Math.max(1, fineTuningWidth);
                        value = 1 + segmentPercentage * (fineTuningLimit - 1);
                    } else {
                        const segmentPercentage = (clampedCursor - fineTuningCursor) / Math.max(1, ctx.rightSector - fineTuningWidth);
                        value = fineTuningLimit + segmentPercentage * (maxValue - fineTuningLimit);
                    }
                } else {
                    const sectorPercentage = (clampedCursor - ctx.medianCursor) / ctx.rightSector;
                    value = 1 + sectorPercentage * (maxValue - 1);
                }
            }
            return Math.max(minValue, value);
        },

        getComplexTrackCursor: (value: number, trackWidth: number, options: ComplexTrackpadOptions = {}): number => {
            const { fineTuningLimit, fineTuningSegmentRatio = 0.5 } = options;
            const ctx = getContext(trackWidth);
            const safeValue = Math.max(0, value);

            let cursor: number;
            if (safeValue <= 1) {
                cursor = safeValue * ctx.leftSector;
            } else {
                if (fineTuningLimit !== undefined && fineTuningLimit > 1 && fineTuningLimit < maxValue) {
                    const ratio = Math.max(0, Math.min(1, fineTuningSegmentRatio));
                    const fineTuningWidth = Math.floor(ctx.rightSector * ratio);
                    const fineTuningCursor = ctx.medianCursor + fineTuningWidth;

                    if (safeValue <= fineTuningLimit) {
                        const denominator = fineTuningLimit - 1;
                        const segmentPercentage = denominator > 0 ? (safeValue - 1) / denominator : 0;
                        cursor = ctx.medianCursor + segmentPercentage * fineTuningWidth;
                    } else {
                        const denominator = maxValue - fineTuningLimit;
                        const segmentPercentage = denominator > 0 ? (safeValue - fineTuningLimit) / denominator : 0;
                        cursor = fineTuningCursor + segmentPercentage * (ctx.rightSector - fineTuningWidth);
                    }
                } else {
                    const denominator = maxValue - 1;
                    const sectorPercentage = denominator > 0 ? (safeValue - 1) / denominator : 0;
                    cursor = ctx.medianCursor + (sectorPercentage * ctx.rightSector);
                }
            }
            return Math.max(0, Math.min(Math.round(cursor), ctx.maxCursor));
        }
    }), [getContext, maxValue]);
}