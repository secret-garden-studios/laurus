/**
 * Where an object sits relative to the mask it belongs to, and how the four
 * reorder buttons move it there.
 *
 * The whole model is one sheet and two stacks. Order 0 is the mask's own plane
 * and not a slot: positive orders stack in front of the sheet, negative ones
 * behind it, and an object's magnitude ranks it against the mask's other
 * objects on that same side. A mask holding three ordered objects reads
 * -1, 1, 2 -- there is no 0 in it.
 *
 * Nothing here renders. What consumes the result is mask-gl.ts, which reads the
 * sign to decide whether an object's travelling pixels composite in front of
 * the mask or behind it (and whether it raises relief at all), and reads the
 * magnitude to settle which of two overlapping objects takes a pixel.
 */

/**
 * The order an object carries when nothing has ranked it -- the mask's own
 * plane, which is not a slot an object can really occupy.
 *
 * Every object stored before Object_V1_0.order existed reads back as this, so
 * it has to mean "unranked" rather than "on the sheet": stackedObjects breaks a
 * run of them by object id and leaves such a mask looking exactly as it did.
 * The renumber the first reorder performs is what turns the whole mask real.
 */
export const OBJECT_ORDER_UNRANKED = 0;

/** One object's place in its mask's stack, as the two numbers that decide it. */
export interface StackedObject {
  id: number;
  order: number;
}

/**
 * The mask's objects from the back of the stack to the front.
 *
 * Order first, then id -- and the id is not a cosmetic tie-break. Every object
 * stored before ordering existed reads back at OBJECT_ORDER_UNRANKED, so a
 * legacy mask is a single run of ties, and breaking them by id is what makes
 * such a mask keep the stacking it already had rather than shuffling on load.
 * It is also what gives `reorderObjects` a definite list to move a target
 * through before any real order has ever been written.
 */
export function stackedObjects<T extends StackedObject>(objects: readonly T[]): T[] {
  return objects.slice().sort((a, b) => a.order - b.order || a.id - b.id);
}

export type ObjectOrderDirection = "increment" | "decrement" | "top" | "bottom";

/**
 * How many of a stack sit behind the mask -- the position of the sheet within
 * the ranked list, counted from the back.
 *
 * Read off the stored orders rather than recomputed from anything, because it
 * is the one thing a renumber must carry across unchanged: the objects behind
 * the mask are behind it because someone put them there, and a reorder that
 * derived the plane's position instead would drag them across it every time an
 * unrelated object moved.
 */
function planePosition(stack: readonly StackedObject[]): number {
  return stack.filter((object) => object.order < 0).length;
}

/**
 * Ranks a whole stack densely around the sheet: -k..-1 behind it, 1..n-k in
 * front, and no 0 anywhere.
 *
 * Dense rather than sparse so that the numbers stay legible and "one step" is
 * always one integer. It renumbers every object rather than only the one that
 * moved, which is why `reorderObjects` returns a list of changes and not a
 * single edit -- see there for why that is a feature rather than a cost.
 */
function ranked<T extends StackedObject>(stack: readonly T[], behind: number): { object: T; order: number }[] {
  return stack.map((object, index) => ({
    object,
    order: index < behind ? index - behind : index - behind + 1,
  }));
}

export interface ObjectOrderChange {
  id: number;
  order: number;
}

/**
 * One reorder of one object, as the set of objects whose order it changes.
 *
 * A step is taken against the ranked list rather than against the stored
 * numbers, so it means the same thing whatever state the mask is in -- a legacy
 * mask of all-zero orders steps exactly like a fully ranked one, and the move
 * that lands is also the move that finally writes real orders to the whole
 * mask.
 *
 * Crossing the sheet is what "up" and "down" mean at the boundary, and it is
 * the one move that changes nothing about position in the list. An object at
 * the front of the behind-stack that moves up does not swap with anything: it
 * stays exactly where it is and the sheet slides past it, which is the same
 * gesture as walking a card from behind a page to in front of it. `top` and
 * `bottom` are absolute for the same reason -- the front of everything is in
 * front of the mask, and the back of everything is behind it.
 *
 * Returns only the objects whose order actually moved. On an already-ranked
 * mask a step is two objects and a jump is a handful; on a mask still sitting
 * at all-zero it is every object, once. The caller is writing these one at a
 * time down a socket that full-replaces each object, so the difference matters.
 */
export function reorderObjects<T extends StackedObject>(
  objects: readonly T[],
  targetId: number,
  direction: ObjectOrderDirection,
): ObjectOrderChange[] {
  const stack = stackedObjects(objects);
  const index = stack.findIndex((object) => object.id === targetId);
  if (index < 0) return [];

  const behind = planePosition(stack);
  let moved = stack;
  let movedBehind = behind;

  switch (direction) {
    case "increment": {
      // At the front of the behind-stack there is nothing to swap with: the
      // step is the sheet passing under this object, and only the count moves.
      if (index === behind - 1) {
        movedBehind = behind - 1;
        break;
      }
      if (index === stack.length - 1) return [];
      moved = stack.slice();
      [moved[index], moved[index + 1]] = [moved[index + 1], moved[index]];
      break;
    }
    case "decrement": {
      // The mirror of the above: the back of the in-front stack sinks behind
      // the sheet without changing places with any object.
      if (index === behind) {
        movedBehind = behind + 1;
        break;
      }
      if (index === 0) return [];
      moved = stack.slice();
      [moved[index], moved[index - 1]] = [moved[index - 1], moved[index]];
      break;
    }
    case "top": {
      moved = stack.slice();
      const [target] = moved.splice(index, 1);
      moved.push(target);
      // The front of everything is in front of the sheet, so an object coming
      // from behind it takes the plane one step back with it.
      if (index < behind) movedBehind = behind - 1;
      break;
    }
    case "bottom": {
      moved = stack.slice();
      const [target] = moved.splice(index, 1);
      moved.unshift(target);
      if (index >= behind) movedBehind = behind + 1;
      break;
    }
  }

  return ranked(moved, movedBehind)
    .filter(({ object, order }) => object.order !== order)
    .map(({ object, order }) => ({ id: object.id, order }));
}

/**
 * The mask's objects the way a stack is read on screen: front first, back last.
 *
 * The reverse of stackedObjects, and named for the reading rather than for the
 * reversal because the two orientations mean different things to different
 * callers. Ranking is a back-to-front sum -- what is drawn over what -- while a
 * list of layers is conventionally front-to-back, topmost first. Both are the
 * same stack; only which end is called "first" differs.
 */
export function frontToBackObjects<T extends StackedObject>(objects: readonly T[]): T[] {
  return stackedObjects(objects).reverse();
}

/**
 * Where the mask's own plane falls in a front-to-back reading -- how many
 * objects are stacked in front of the sheet, and so the row index the sheet
 * itself occupies.
 */
export function frontToBackDividerIndex(objects: readonly StackedObject[]): number {
  return objects.filter((object) => !isBehindMask(object)).length;
}

/**
 * The whole stack rewritten from a front-to-back sequence and the place the
 * mask's plane sits in it.
 *
 * This is the drag-and-drop twin of reorderObjects: that one takes a step and
 * works out the sequence, this one is handed the sequence and works out the
 * orders. Both hand back only the objects whose order actually moved, and both
 * rank the result identically -- 1..n-k counting forward from the sheet and
 * -1..-k counting back from it, with nothing left on 0.
 *
 * `dividerIndex` is what makes a drag able to change an object's *side* rather
 * than just its place, which is most of why the divider is a row you can drag
 * past rather than a line drawn between two groups. Everything before that
 * index is in front of the mask, everything from it on is behind: an object
 * dropped below the sheet's row comes back with a negative order and stops
 * raising relief, which is the entire gesture.
 */
export function restackObjects<T extends StackedObject>(
  objects: readonly T[],
  frontToBackIds: readonly number[],
  dividerIndex: number,
): ObjectOrderChange[] {
  const held = new Map(objects.map((object) => [object.id, object]));
  const changes: ObjectOrderChange[] = [];
  frontToBackIds.forEach((id, index) => {
    const object = held.get(id);
    if (!object) return;
    // Counting down to the sheet in front of it and away from the sheet behind
    // it, so the frontmost row holds the largest order and the row just under
    // the divider holds -1.
    const order = index < dividerIndex ? dividerIndex - index : dividerIndex - index - 1;
    if (object.order !== order) changes.push({ id, order });
  });
  return changes;
}

/** The mask's own plane, as it appears in a row list alongside object ids. */
export const MASK_PLANE_ROW = "plane";
export type StackRow = number | typeof MASK_PLANE_ROW;

/** The rows an expanded mask shows: its objects front to back, plane spliced in. */
export function stackRows(objects: readonly StackedObject[]): StackRow[] {
  const ids: StackRow[] = frontToBackObjects(objects).map((object) => object.id);
  const divider = frontToBackDividerIndex(objects);
  return [...ids.slice(0, divider), MASK_PLANE_ROW, ...ids.slice(divider)];
}

/**
 * One row dragged to a new place in the list, as the orders it lands on.
 *
 * All of the index arithmetic a drop involves, kept here rather than in the
 * component so it can be reasoned about without a browser -- and because the
 * interesting behaviour is not obvious from the gesture.
 *
 * Dropping an object *onto* the plane row is the case worth stating. The moved
 * row takes that index and the plane shifts up one, so the object ends up
 * behind the mask. That is what makes the gesture reachable at all on a mask
 * whose objects are all in front: there is no row below the plane to aim at, so
 * the plane itself has to be the target that sends something past it.
 */
export function restackFromDrop<T extends StackedObject>(
  objects: readonly T[],
  rows: readonly StackRow[],
  fromIndex: number,
  toIndex: number,
): ObjectOrderChange[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) return [];
  const moved = rows.slice();
  moved.splice(toIndex, 0, ...moved.splice(fromIndex, 1));
  const divider = moved.indexOf(MASK_PLANE_ROW);
  // The plane is always in the list, so losing it means the caller built rows
  // some other way and the sign boundary is not knowable.
  if (divider === -1) return [];
  const frontToBackIds = moved.filter((row): row is number => row !== MASK_PLANE_ROW);
  return restackObjects(objects, frontToBackIds, divider);
}

/**
 * The order a newly drawn object takes.
 *
 * The front of the mask, ahead of everything already on it -- what "I just put
 * this here" means, and what keeps a new object from appearing underneath one
 * that happens to overlap it. A mask whose objects are all still unranked
 * yields 1, so the new object is the first thing on it to hold a real order
 * and every legacy object stays behind it by the id tie-break.
 */
export function frontObjectOrder(objects: readonly StackedObject[]): number {
  return Math.max(OBJECT_ORDER_UNRANKED, ...objects.map((object) => object.order)) + 1;
}

/** Whether this object stacks behind the mask rather than in front of it. */
export function isBehindMask(object: { order: number }): boolean {
  return object.order < 0;
}
