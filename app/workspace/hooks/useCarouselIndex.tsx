import { useState, useContext } from "react";
import { HoverContext } from "../workspace.client";
import { CarouselEntry, LaurusActiveElement } from "../states/ui-state";

// Nearest entry to `index` that `isNavigable` accepts (expanding outward in both directions from
// `index`), falling back to `index` itself if nothing in `entries` qualifies. Lets an effect whose
// units only some entry types (e.g. light-source-unit.tsx's captures-only equations) keep its
// derived index off the types it can't act on, without a runtime pass to correct it after the fact.
function nearestNavigableIndex(
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
  // Restricts every index this hook derives (initial, active-element sync, and out-of-bounds
  // fallback alike) to entries this effect can actually act on -- e.g. light-source-unit.tsx
  // passes one that accepts only "capture" entries, since a whole mask has no epicenter of its
  // own for light source to drive. Omit for effects wireable to every entry type.
  isNavigable?: (entry: CarouselEntry) => boolean,
) => {
  const { mostRecentlyEnteredEffectUnitKey } = useContext(HoverContext);
  const activeKey = activeElement?.key;
  const locallyActivatedKey = activeElement?.locallyActivatedEffectKey;
  const totalEntries = carouselEntries.length;
  const clampIndex = (index: number) => {
    if (totalEntries === 0) return 0;
    const clamped = Math.max(0, Math.min(index, totalEntries - 1));
    return isNavigable ? nearestNavigableIndex(carouselEntries, clamped, isNavigable) : clamped;
  };
  // A mask key can now match several entries (one per capture -- see CarouselEntry's own doc
  // comment), so a capture-specific activeElement needs to land on its own entry, not just
  // whichever of the mask's entries happens to be first. When activeElement is a "capture", a
  // "mask" (whole-element) entry sharing the same key must NOT match here -- it always sits
  // before its captures in carouselEntries (see workspace.client.tsx's initCarouselEntries), so
  // without this exclusion findIndex would always land back on that whole-mask entry instead of
  // the specific capture, making chevron navigation between a mask's own captures a no-op.
  const activeIndex = carouselEntries.findIndex((c) => {
    if (c.key !== activeKey) return false;
    if (activeElement?.type === "capture") {
      return c.type === "capture" && c.captureId === activeElement.captureId;
    }
    return true;
  });
  const baseIndex = clampIndex(activeIndex > -1 ? activeIndex : carouselIndexInit);
  const [localIndex, setLocalIndex] = useState(() => clampIndex(carouselIndexInit));
  const [prevKey, setPrevKey] = useState(activeKey);

  // Handle dynamic item deletions (Force reset to 0, or nearest navigable entry, if out of bounds)
  if (totalEntries > 0 && localIndex >= totalEntries) {
    setLocalIndex(clampIndex(0));
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

  const safeLocalIndex = totalEntries > 0 && localIndex >= totalEntries ? clampIndex(0) : localIndex;
  const carouselIndex = locallyActivatedKey === effectKey ? baseIndex : safeLocalIndex;

  return {
    carouselIndex,
    localIndex: safeLocalIndex,
    setLocalIndex,
  };
};
