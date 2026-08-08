import { useState, useContext } from "react";
import { HoverContext } from "../workspace.client";
import { CarouselEntry, LaurusActiveElement } from "../states/ui-state";

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
  // A mask key can now match several entries (one per capture -- see CarouselEntry's own doc
  // comment), so a capture-specific activeElement needs to land on its own entry, not just
  // whichever of the mask's entries happens to be first.
  const activeIndex = carouselEntries.findIndex((c) => {
    if (c.key !== activeKey) return false;
    if (c.type === "mask" && activeElement?.type === "mask" && activeElement.activeCaptureId !== undefined) {
      return c.captureId === activeElement.activeCaptureId;
    }
    return true;
  });
  const baseIndex = clampIndex(activeIndex > -1 ? activeIndex : carouselIndexInit);
  const [localIndex, setLocalIndex] = useState(() => clampIndex(carouselIndexInit));
  const [prevKey, setPrevKey] = useState(activeKey);

  // Handle dynamic item deletions (Force reset to 0 if out of bounds)
  if (totalEntries > 0 && localIndex >= totalEntries) {
    setLocalIndex(0);
  }

  const shouldSync = !mostRecentlyEnteredEffectUnitKey || mostRecentlyEnteredEffectUnitKey === effectKey;

  // Sync local carousels on selection from the canvas area. Gated on activeKey !== undefined --
  // handlePlayAll/handlePlayTarget (workspace.client.tsx) clear activeElement before every
  // playback to drop the canvas highlight, which would otherwise look like "selection moved to
  // nothing" here and snap this carousel back to carouselIndexInit (whichever entry happened to
  // match first at mount), discarding whatever capture/element the user had actually navigated to.
  if (activeKey !== prevKey) {
    setPrevKey(activeKey);
    if (activeKey !== undefined && locallyActivatedKey === undefined && shouldSync) {
      setLocalIndex(baseIndex);
    }
  }

  const safeLocalIndex = totalEntries > 0 && localIndex >= totalEntries ? 0 : localIndex;
  const carouselIndex = locallyActivatedKey === effectKey ? baseIndex : safeLocalIndex;

  return {
    carouselIndex,
    localIndex: safeLocalIndex,
    setLocalIndex,
  };
};
