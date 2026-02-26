import { useCallback, useMemo } from 'react';

export interface TrackpadState {
    getTrackValue: (cursor: number, trackSize: number) => number;
    getTrackCursor: (value: number, trackSize: number) => number;
}

export function useTrackpadState(offset: number, maxValue: number): TrackpadState {

    const getContext = useCallback((trackSize: number) => {
        const maxCursor = Math.max(0, trackSize - (offset));
        return { maxCursor };
    }, [offset]);

    return useMemo(() => ({
        getTrackValue: (cursor: number, trackSize: number): number => {
            const ctx = getContext(trackSize);
            const clampedCX = Math.max(0, Math.min(cursor, ctx.maxCursor));
            const percentage: number = clampedCX / ctx.maxCursor;
            const value: number = percentage * maxValue;
            return Math.max(0, value);
        },

        getTrackCursor: (value: number, trackSize: number): number => {
            const ctx = getContext(trackSize);
            const safeValue = Math.max(0, value);
            const percentage = safeValue / maxValue;
            const coordinate = percentage * ctx.maxCursor;
            return Math.max(0, Math.min(Math.round(coordinate), ctx.maxCursor));
        }
    }), [getContext, maxValue]);
}