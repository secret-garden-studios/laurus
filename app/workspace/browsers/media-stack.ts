export interface StackedMedia {
  type: "img" | "svg" | "mask";
  key: string;
  order: number;
}

export function backToFrontMedia<T extends StackedMedia>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => a.order - b.order);
}

export function frontToBackMedia<T extends StackedMedia>(items: readonly T[]): T[] {
  return backToFrontMedia(items).reverse();
}

export function restackGroupWithinProject(
  items: readonly StackedMedia[],
  groupFrontToBack: readonly string[],
): Map<string, number> {
  const present = new Set(items.map((item) => item.key));
  const listed = groupFrontToBack.filter((key) => present.has(key));
  const groupKeys = new Set(listed);
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
