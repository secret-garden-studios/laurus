import { useState, useContext } from "react";
import { HoverContext } from "../workspace.client";
import { CarouselEntry, LaurusActiveElement } from "../states/ui-state";

export function nearestNavigableIndex(
  entries: CarouselEntry[],
  index: number,
  isNavigable: (entry: CarouselEntry) => boolean,
): number {
  if (index >= 0 && index < entries.length && isNavigable(entries[index])) return index;
  for (let offset = 1; offset < entries.length; offset++) {
    const forward = index + offset;
    if (forward < entries.length && isNavigable(entries[forward])) return forward;
    const backward = index - offset;
    if (backward >= 0 && isNavigable(entries[backward])) return backward;
  }
  return index;
}

export const useCarouselIndex = (
  activeElement: LaurusActiveElement | undefined,
  carouselEntries: CarouselEntry[],
  carouselIndexInit: number,
  effectKey: string,
  isNavigable?: (entry: CarouselEntry) => boolean,
) => {
  const { getMostRecentlyEnteredEffectUnitKey } = useContext(HoverContext);
  const activeKey = activeElement?.key;
  const locallyActivatedKey = activeElement?.locallyActivatedEffectKey;
  const totalEntries = carouselEntries.length;
  const clampIndex = (index: number) => {
    if (totalEntries === 0) return 0;
    const clamped = Math.max(0, Math.min(index, totalEntries - 1));
    return isNavigable ? nearestNavigableIndex(carouselEntries, clamped, isNavigable) : clamped;
  };
  const activeIndex = carouselEntries.findIndex((c) => {
    if (c.key !== activeKey) return false;
    if (activeElement?.type === "light") {
      return c.type === "light" && c.lightId === activeElement.lightId;
    }
    if (activeElement?.type === "object") {
      return c.type === "object" && c.objectId === activeElement.objectId;
    }
    return true;
  });
  const baseIndex = clampIndex(activeIndex > -1 ? activeIndex : carouselIndexInit);
  const [localIndex, setLocalIndex] = useState(() => clampIndex(carouselIndexInit));
  const [prevKey, setPrevKey] = useState(activeKey);

  if (totalEntries > 0 && localIndex >= totalEntries) {
    setLocalIndex(clampIndex(0));
  }

  const mostRecentlyEnteredEffectUnitKey = getMostRecentlyEnteredEffectUnitKey();
  const shouldSync = !mostRecentlyEnteredEffectUnitKey || mostRecentlyEnteredEffectUnitKey === effectKey;

  if (activeKey !== prevKey) {
    setPrevKey(activeKey);
    if (activeKey !== undefined && locallyActivatedKey === undefined && shouldSync) {
      setLocalIndex(baseIndex);
    }
  }

  const safeLocalIndex = totalEntries > 0 && localIndex >= totalEntries ? clampIndex(0) : localIndex;
  const carouselIndex = locallyActivatedKey === effectKey ? baseIndex : safeLocalIndex;

  return {
    carouselIndex,
    localIndex: safeLocalIndex,
    setLocalIndex,
  };
};
