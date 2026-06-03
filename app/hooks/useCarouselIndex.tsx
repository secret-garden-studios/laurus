import { useState, useContext } from 'react';
import { CarouselEntry, LaurusActiveElement, HoverContext } from '../workspace/workspace.client';

export const useCarouselIndex = (
    activeElement: LaurusActiveElement | undefined,
    carouselEntries: CarouselEntry[],
    carouselIndexInit: number,
    effectKey: string,
) => {
    const { mostRecentlyEnteredEffectUnitKey } = useContext(HoverContext);
    const activeKey = activeElement?.key;
    const locallyActivatedKey = activeElement?.locallyActivatedEffectKey;
    const totalEntries = carouselEntries.length;
    const clampIndex = (index: number) => {
        if (totalEntries === 0) return 0;
        return Math.max(0, Math.min(index, totalEntries - 1));
    };
    const activeIndex = carouselEntries.findIndex((c) => c.key === activeKey);
    const baseIndex = clampIndex(activeIndex > -1 ? activeIndex : carouselIndexInit);
    const [localIndex, setLocalIndex] = useState(() => clampIndex(carouselIndexInit));
    const [prevKey, setPrevKey] = useState(activeKey);

    // Handle dynamic item deletions (Force reset to 0 if out of bounds)
    if (totalEntries > 0 && localIndex >= totalEntries) {
        setLocalIndex(0);
    }

    const shouldSync = !mostRecentlyEnteredEffectUnitKey || mostRecentlyEnteredEffectUnitKey === effectKey;

    // Sync local carousels on selection from the canvas area
    if (activeKey !== prevKey) {
        setPrevKey(activeKey);
        if (locallyActivatedKey === undefined && shouldSync) {
            setLocalIndex(baseIndex);
        }
    }

    const safeLocalIndex = totalEntries > 0 && localIndex >= totalEntries ? 0 : localIndex;
    const carouselIndex = locallyActivatedKey === effectKey ? baseIndex : safeLocalIndex;

    return {
        carouselIndex,
        localIndex: safeLocalIndex,
        setLocalIndex
    };
};
