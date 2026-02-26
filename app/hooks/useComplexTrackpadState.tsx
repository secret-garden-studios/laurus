import { useCallback, useMemo } from 'react';

export interface ComplexTrackpadState {
    getComplexTrackValue: (cursor: number, trackWidth: number) => number;
    getComplexTrackCursor: (value: number, trackWidth: number) => number;
}

export function useComplexTrackpadState(offset: number, maxValue: number): ComplexTrackpadState {

    const getContext = useCallback((trackWidth: number) => {
        const maxCursor = Math.max(0, trackWidth - (offset));
        const medianCursor = Math.ceil(maxCursor / 2);
        const leftSector = Math.max(1, medianCursor);
        const rightSector = Math.max(1, maxCursor - medianCursor);

        let rightReBase = 0;
        for (let coordinate = 0; coordinate < rightSector; coordinate++) {
            if ((coordinate / rightSector) * maxValue <= 1) {
                rightReBase = coordinate;
            } else {
                break;
            }
        }

        const safeReBase = Math.max(1, rightReBase);
        const maxRebasedScale = ((rightReBase / rightSector) * maxValue) / 10;

        return { medianCursor, maxCursor, rightSector, leftSector, rightReBase, safeReBase, maxRebasedScale };
    }, [offset, maxValue]);

    return useMemo(() => ({
        getComplexTrackValue: (cursor: number, trackWidth: number): number => {
            const ctx = getContext(trackWidth);
            const clampedCursor = Math.max(0, Math.min(cursor, ctx.maxCursor));

            if (clampedCursor === ctx.medianCursor) return 1;

            let value: number;
            if (clampedCursor > ctx.medianCursor) {
                const cursorPercentage = (clampedCursor - ctx.medianCursor) / ctx.rightSector;
                if (cursorPercentage * maxValue <= 1) {
                    value = 1 + (((clampedCursor - ctx.medianCursor) / ctx.safeReBase) * ctx.maxRebasedScale);
                } else {
                    value = cursorPercentage * maxValue;
                }
            } else {
                value = clampedCursor / ctx.leftSector;
            }
            return Math.max(0, value);
        },

        getComplexTrackCursor: (value: number, trackWidth: number): number => {
            const ctx = getContext(trackWidth);
            const safeValue = Math.max(0, value);
            let cursor: number;

            if (safeValue === 1) {
                cursor = ctx.medianCursor;
            } else if (safeValue > 1) {
                if (safeValue <= 1 + ctx.maxRebasedScale && ctx.maxRebasedScale > 0) {
                    cursor = ((safeValue - 1) / ctx.maxRebasedScale * ctx.rightReBase) + ctx.medianCursor;
                } else {
                    cursor = (safeValue / maxValue * ctx.rightSector) + ctx.medianCursor;
                }
            } else {
                cursor = safeValue * ctx.leftSector;
            }
            return Math.max(0, Math.min(Math.round(cursor), ctx.maxCursor));
        }
    }), [getContext, maxValue]);
}