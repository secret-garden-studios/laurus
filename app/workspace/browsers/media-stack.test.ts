import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backToFrontMedia, frontToBackMedia, restackGroupWithinProject, type StackedMedia } from "./media-stack.ts";

/** A project stack, given back to front, as `key` at `order` = its index. */
function project(...keys: string[]): StackedMedia[] {
  return keys.map((key, order) => ({ type: "img" as const, key, order }));
}

/** The whole project stack after a drop, front to back. */
function applied(items: StackedMedia[], groupFrontToBack: string[]): string[] {
  const moved = restackGroupWithinProject(items, groupFrontToBack);
  const next = items.map((item) => ({ ...item, order: moved.get(item.key) ?? item.order }));
  return frontToBackMedia(next).map((item) => item.key);
}

describe("frontToBackMedia", () => {
  it("reads the stack topmost first", () => {
    assert.deepEqual(
      frontToBackMedia(project("a", "b", "c")).map((i) => i.key),
      ["c", "b", "a"],
    );
  });

  it("does not mutate its input", () => {
    const items = project("a", "b", "c");
    frontToBackMedia(items);
    assert.deepEqual(
      items.map((i) => i.key),
      ["a", "b", "c"],
    );
  });
});

describe("backToFrontMedia", () => {
  it("counts the way the stored orders count", () => {
    const shuffled = [
      { type: "svg" as const, key: "c", order: 2 },
      { type: "img" as const, key: "a", order: 0 },
      { type: "mask" as const, key: "b", order: 1 },
    ];
    assert.deepEqual(
      backToFrontMedia(shuffled).map((i) => i.key),
      ["a", "b", "c"],
    );
  });
});

describe("restackGroupWithinProject", () => {
  it("takes the group's keys front first, the way the list reads", () => {
    // project a,b,c back to front; the whole project is one group, dragged so
    // that a is now frontmost
    const items = project("a", "b", "c");
    assert.deepEqual(applied(items, ["a", "c", "b"]), ["a", "c", "b"]);
  });

  it("leaves media outside the group exactly where it was", () => {
    // stack a,b,c,d,e back to front; the group is b, c, e
    const items = project("a", "b", "c", "d", "e");
    const moved = restackGroupWithinProject(items, ["b", "e", "c"]);
    assert.equal(moved.has("a"), false);
    assert.equal(moved.has("d"), false);
  });

  it("keeps the group's own slots and only trades who holds them", () => {
    const items = project("a", "b", "c", "d", "e");
    // group b(1), c(2), e(4) dragged to read b, e, c front-to-back
    const next = restackGroupWithinProject(items, ["b", "e", "c"]);
    // the slots 1, 2 and 4 are still the group's, back to front: c, e, b
    assert.equal(next.get("c"), 1);
    assert.equal(next.get("e"), 2);
    assert.equal(next.get("b"), 4);
  });

  it("puts the frontmost listed key at the group's frontmost slot", () => {
    const items = project("a", "b", "c", "d", "e");
    const order = applied(items, ["b", "e", "c"]);
    // d sits between the group's middle and top slots and stays there
    assert.deepEqual(order, ["b", "d", "e", "c", "a"]);
  });

  it("reports nothing when the drop changed nothing", () => {
    const items = project("a", "b", "c");
    assert.deepEqual([...restackGroupWithinProject(items, ["c", "b", "a"])], []);
  });

  it("handles a group of one", () => {
    const items = project("a", "b", "c");
    assert.deepEqual([...restackGroupWithinProject(items, ["b"])], []);
  });

  it("handles an empty group", () => {
    const items = project("a", "b");
    assert.deepEqual([...restackGroupWithinProject(items, [])], []);
  });

  it("never drops a key out of the stack, whatever the group says", () => {
    const items = project("a", "b", "c", "d");
    const moved = restackGroupWithinProject(items, ["d", "b"]);
    const next = items.map((item) => ({ ...item, order: moved.get(item.key) ?? item.order }));
    assert.deepEqual(
      backToFrontMedia(next)
        .map((i) => i.key)
        .sort(),
      ["a", "b", "c", "d"],
    );
    // and the orders it produces are still a dense 0..n-1
    assert.deepEqual(
      next.map((i) => i.order).sort((x, y) => x - y),
      [0, 1, 2, 3],
    );
  });

  it("survives a group key the project does not hold", () => {
    const items = project("a", "b");
    const moved = restackGroupWithinProject(items, ["b", "a", "ghost"]);
    assert.equal(moved.has("ghost"), false);
  });

  it("mixes types without treating any of them differently", () => {
    const items: StackedMedia[] = [
      { type: "img", key: "i", order: 0 },
      { type: "svg", key: "s", order: 1 },
      { type: "mask", key: "m", order: 2 },
    ];
    // read front first: m, s, i -- drag i to the front
    assert.deepEqual(applied(items, ["i", "m", "s"]), ["i", "m", "s"]);
  });
});
