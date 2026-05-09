import { useMemo, useState } from 'react';
import { CarouselEntry, LaurusActiveElement } from '../workspace/workspace.client';

export const useCarouselIndex = (
    activeElement: LaurusActiveElement | undefined,
    carouselEntries: CarouselEntry[],
    carouselIndexInit: number,
    effectKey: string) => {
    const [localIndex, setLocalIndex] = useState(carouselIndexInit);
    const [prevKey, setPrevKey] = useState(activeElement?.key);
    const activeKey = activeElement?.key;
    const locallyActivedKey = activeElement?.locallyActivatedEffectKey;
    const activeIndex = carouselEntries.findIndex(
        (c: CarouselEntry) => c.key === activeKey
    );

    if (activeKey !== prevKey) {
        setPrevKey(activeKey);
        if (locallyActivedKey === undefined) {
            setLocalIndex(activeIndex);
        }
    }
    
    const carouselIndex = useMemo(() => {
        const baseIndex = activeIndex > -1 ? activeIndex : carouselIndexInit;
        if (locallyActivedKey !== undefined) {
            return locallyActivedKey !== effectKey ? localIndex : baseIndex;
        }
        return baseIndex;
    }, [activeIndex, locallyActivedKey, effectKey, localIndex, carouselIndexInit]);

    return { carouselIndex, localIndex, setLocalIndex };
};
