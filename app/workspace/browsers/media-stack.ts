/**
 * Where a project's media sits in the canvas stack, and what a drag inside one
 * media group does to it.
 *
 * A project's imgs, svgs and masks share one `order` running 0..n-1 across all
 * three, and that number feeds z-index directly: the largest is drawn in front.
 * A media group is a *subset* of that stack, so reordering within a group has
 * to leave everything outside it exactly where it was -- which is the whole
 * reason this is worth a function of its own rather than a sort.
 */

export interface StackedMedia {
  type: "img" | "svg" | "mask";
  key: string;
  order: number;
}

/**
 * The project's media as the canvas stacks it: back to front, which is the
 * order the numbers themselves run in.
 */
export function backToFrontMedia<T extends StackedMedia>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => a.order - b.order);
}

/**
 * The project's media the way a list of layers is read: front first.
 *
 * The same stack, turned over. Matches how a mask's expanded objects read (see
 * frontToBackObjects) so that one browser does not run two directions at once.
 */
export function frontToBackMedia<T extends StackedMedia>(items: readonly T[]): T[] {
  return backToFrontMedia(items).reverse();
}

/**
 * One group reordered, as the new order for every media in the project.
 *
 * `groupFrontToBack` is the group's keys in the reading the drop left them in,
 * front first -- the display order, handed over as-is so no caller has to
 * remember to turn it back the right way up.
 *
 * The rule is that a group's members trade places only with each other. They
 * keep whichever slots in the project-wide stack they already occupied, and the
 * media between those slots that is not in the group keeps its own place
 * relative to them. So a group whose members are 2nd and 5th in the project
 * stays 2nd and 5th; only which of the two is which can change. Reordering a
 * group can therefore never push unrelated media forward or back, which is what
 * makes a group safe to rearrange without looking at the rest of the canvas.
 *
 * Returns only the keys whose order actually moved.
 */
export function restackGroupWithinProject(
  items: readonly StackedMedia[],
  groupFrontToBack: readonly string[],
): Map<string, number> {
  // Narrowed to what the project actually holds before anything is counted.
  // The slots being filled are the ones these keys already occupy, so a listed
  // key the project does not have would consume a slot that belongs to a key it
  // does -- pushing real media off the end of the stack rather than reordering
  // it. A group naming media that has since been deleted is an ordinary race,
  // not a caller error.
  const present = new Set(items.map((item) => item.key));
  const listed = groupFrontToBack.filter((key) => present.has(key));
  const groupKeys = new Set(listed);
  // Back to front, because that is the direction the stored orders count in and
  // the direction the slots below are filled in.
  const backToFront = [...listed].reverse();

  let cursor = 0;
  const restacked = backToFrontMedia(items).map((item) => {
    if (!groupKeys.has(item.key)) return item.key;
    const replacement = backToFront[cursor];
    cursor += 1;
    return replacement ?? item.key;
  });

  const held = new Map(items.map((item) => [item.key, item.order]));
  const moved = new Map<string, number>();
  restacked.forEach((key, order) => {
    if (held.get(key) !== order) moved.set(key, order);
  });
  return moved;
}
