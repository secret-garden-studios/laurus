export const MASK_ORDER_UNRANKED = 0;
export const MASK_ORDER_EPSILON = 0.5;

export interface StackRef {
  kind: "object" | "light";
  id: number;
}

export interface StackedElement extends StackRef {
  order: number;
}

export function sameRef(a: StackRef, b: StackRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function refKey(ref: StackRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function maskStack(mask: {
  objects: readonly { id: number; order: number }[];
  lights: readonly { id: number; order: number }[];
}): StackedElement[] {
  return [
    ...mask.objects.map(({ id, order }) => ({ kind: "object" as const, id, order })),
    ...mask.lights.map(({ id, order }) => ({ kind: "light" as const, id, order })),
  ];
}

export function occludes(objectOrder: number, lightOrder: number): boolean {
  if (lightOrder === MASK_ORDER_UNRANKED) return false;
  return objectOrder > lightOrder;
}

export function stackedElements<T extends StackedElement>(elements: readonly T[]): T[] {
  return elements.slice().sort((a, b) => a.order - b.order || kindRank(a.kind) - kindRank(b.kind) || a.id - b.id);
}

function kindRank(kind: StackRef["kind"]): number {
  return kind === "object" ? 0 : 1;
}

export type StackDirection = "increment" | "decrement" | "top" | "bottom";

function planePosition(stack: readonly StackedElement[]): number {
  return stack.filter((element) => element.order < 0).length;
}

function ranked<T extends StackedElement>(stack: readonly T[], behind: number): { element: T; order: number }[] {
  return stack.map((element, index) => ({
    element,
    order: index < behind ? index - behind : index - behind + 1,
  }));
}

export interface StackChange extends StackRef {
  order: number;
}

function toChange(element: StackRef, order: number): StackChange {
  return { kind: element.kind, id: element.id, order };
}

export function reorderElements<T extends StackedElement>(
  elements: readonly T[],
  target: StackRef,
  direction: StackDirection,
): StackChange[] {
  const stack = stackedElements(elements);
  const index = stack.findIndex((element) => sameRef(element, target));
  if (index < 0) return [];

  const behind = planePosition(stack);
  let moved = stack;
  let movedBehind = behind;

  switch (direction) {
    case "increment": {
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
      const [held] = moved.splice(index, 1);
      moved.push(held);
      if (index < behind) movedBehind = behind - 1;
      break;
    }
    case "bottom": {
      moved = stack.slice();
      const [held] = moved.splice(index, 1);
      moved.unshift(held);
      if (index >= behind) movedBehind = behind + 1;
      break;
    }
  }

  return ranked(moved, movedBehind)
    .filter(({ element, order }) => element.order !== order)
    .map(({ element, order }) => toChange(element, order));
}

export function frontToBackElements<T extends StackedElement>(elements: readonly T[]): T[] {
  return stackedElements(elements).reverse();
}

export function frontToBackDividerIndex(elements: readonly StackedElement[]): number {
  return elements.filter((element) => !isBehindMask(element)).length;
}

export function restackElements<T extends StackedElement>(
  elements: readonly T[],
  frontToBackRefs: readonly StackRef[],
  dividerIndex: number,
): StackChange[] {
  const held = new Map(elements.map((element) => [refKey(element), element]));
  const changes: StackChange[] = [];
  frontToBackRefs.forEach((ref, index) => {
    const element = held.get(refKey(ref));
    if (!element) return;
    const order = index < dividerIndex ? dividerIndex - index : dividerIndex - index - 1;
    if (element.order !== order) changes.push(toChange(ref, order));
  });
  return changes;
}

export const MASK_PLANE_ROW = "plane";
export type StackRow = StackRef | typeof MASK_PLANE_ROW;

export function stackRows(elements: readonly StackedElement[]): StackRow[] {
  const refs: StackRow[] = frontToBackElements(elements).map((element) => ({
    kind: element.kind,
    id: element.id,
  }));
  const divider = frontToBackDividerIndex(elements);
  return [...refs.slice(0, divider), MASK_PLANE_ROW, ...refs.slice(divider)];
}

export function restackFromDrop<T extends StackedElement>(
  elements: readonly T[],
  rows: readonly StackRow[],
  fromIndex: number,
  toIndex: number,
): StackChange[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) return [];
  const moved = rows.slice();
  moved.splice(toIndex, 0, ...moved.splice(fromIndex, 1));
  const divider = moved.indexOf(MASK_PLANE_ROW);
  if (divider === -1) return [];
  const frontToBackRefs = moved.filter((row): row is StackRef => row !== MASK_PLANE_ROW);
  return restackElements(elements, frontToBackRefs, divider);
}

export function frontElementOrder(elements: readonly { order: number }[]): number {
  return Math.max(MASK_ORDER_UNRANKED, ...elements.map((element) => element.order)) + 1;
}

export function isBehindMask(element: { order: number }): boolean {
  return element.order < 0;
}
