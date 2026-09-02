import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  frontElementOrder,
  frontToBackDividerIndex,
  frontToBackElements,
  isBehindMask,
  maskStack,
  occludes,
  reorderElements,
  restackElements,
  restackFromDrop,
  stackRows,
  stackedElements,
  MASK_PLANE_ROW,
  type StackDirection,
  type StackedElement,
  type StackRef,
  type StackRow,
} from "./mask-order.ts";

function stack(...orders: number[]): StackedElement[] {
  return orders.map((order, index) => ({ kind: "object" as const, id: index + 1, order }));
}

function obj(id: number): StackRef {
  return { kind: "object", id };
}

function light(id: number): StackRef {
  return { kind: "light", id };
}

function rowIds(rows: readonly StackRow[]): (number | typeof MASK_PLANE_ROW)[] {
  return rows.map((row) => (row === MASK_PLANE_ROW ? row : row.id));
}

function after(objects: StackedElement[], targetId: number, direction: StackDirection): number[] {
  const changes = new Map(reorderElements(objects, obj(targetId), direction).map((c) => [c.id, c.order]));
  const applied = objects.map((object) => ({ ...object, order: changes.get(object.id) ?? object.order }));
  return stackedElements(applied).map((object) => object.order);
}

function orderOfIds(objects: StackedElement[], targetId: number, direction: StackDirection): number[] {
  const changes = new Map(reorderElements(objects, obj(targetId), direction).map((c) => [c.id, c.order]));
  const applied = objects.map((object) => ({ ...object, order: changes.get(object.id) ?? object.order }));
  return stackedElements(applied).map((object) => object.id);
}

describe("stackedElements", () => {
  it("ranks back to front by order", () => {
    assert.deepEqual(
      stackedElements(stack(2, -1, 1)).map((o) => o.order),
      [-1, 1, 2],
    );
  });

  it("breaks a run of unranked objects by id, so a legacy mask keeps its stacking", () => {
    const legacy = [
      { kind: "object" as const, id: 7, order: 0 },
      { kind: "object" as const, id: 2, order: 0 },
      { kind: "object" as const, id: 5, order: 0 },
    ];
    assert.deepEqual(
      stackedElements(legacy).map((o) => o.id),
      [2, 5, 7],
    );
  });

  it("does not mutate its input", () => {
    const objects = stack(3, 1, 2);
    stackedElements(objects);
    assert.deepEqual(
      objects.map((o) => o.order),
      [3, 1, 2],
    );
  });
});

describe("reorderElements", () => {
  it("leaves no object on the mask's own plane", () => {
    for (const direction of ["increment", "decrement", "top", "bottom"] as const) {
      const orders = after(stack(-2, -1, 1, 2, 3), 3, direction);
      assert.equal(orders.includes(0), false, `${direction} put an object on the sheet: ${JSON.stringify(orders)}`);
    }
  });

  it("ranks densely around the sheet", () => {
    assert.deepEqual(after(stack(0, 0, 0), 1, "bottom"), [-1, 1, 2]);
  });

  it("swaps with the next object up, within the front stack", () => {
    assert.deepEqual(orderOfIds(stack(1, 2, 3), 1, "increment"), [2, 1, 3]);
  });

  it("swaps with the next object down, within the front stack", () => {
    assert.deepEqual(orderOfIds(stack(1, 2, 3), 3, "decrement"), [1, 3, 2]);
  });

  it("crosses the sheet without changing places with any object", () => {
    const objects = [
      { kind: "object" as const, id: 1, order: -2 },
      { kind: "object" as const, id: 2, order: -1 },
      { kind: "object" as const, id: 3, order: 1 },
    ];
    const changes = new Map(reorderElements(objects, obj(2), "increment").map((c) => [c.id, c.order]));
    assert.equal(changes.get(2), 1);
    assert.equal(changes.get(3), 2);
    assert.equal(changes.get(1), -1);
  });

  it("sinks the backmost front object behind the sheet", () => {
    const objects = [
      { kind: "object" as const, id: 1, order: 1 },
      { kind: "object" as const, id: 2, order: 2 },
    ];
    const changes = new Map(reorderElements(objects, obj(1), "decrement").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), -1);
    assert.equal(changes.get(2), 1);
  });

  it("sends a lone object behind the mask and brings it back", () => {
    const alone = [{ kind: "object" as const, id: 1, order: 1 }];
    assert.deepEqual(reorderElements(alone, obj(1), "decrement"), [{ kind: "object" as const, id: 1, order: -1 }]);
    assert.deepEqual(reorderElements([{ kind: "object", id: 1, order: -1 }], obj(1), "increment"), [
      { kind: "object" as const, id: 1, order: 1 },
    ]);
  });

  it("moves to the front of everything, which is in front of the mask", () => {
    const objects = [
      { kind: "object" as const, id: 1, order: -2 },
      { kind: "object" as const, id: 2, order: -1 },
      { kind: "object" as const, id: 3, order: 1 },
    ];
    assert.deepEqual(orderOfIds(objects, 1, "top"), [2, 3, 1]);
    const changes = new Map(reorderElements(objects, obj(1), "top").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), 2);
  });

  it("moves to the back of everything, which is behind the mask", () => {
    const objects = stack(1, 2, 3);
    assert.deepEqual(orderOfIds(objects, 3, "bottom"), [3, 1, 2]);
    const changes = new Map(reorderElements(objects, obj(3), "bottom").map((c) => [c.id, c.order]));
    assert.equal(changes.get(3), -1);
  });

  it("refuses to step past either end", () => {
    assert.deepEqual(reorderElements(stack(1, 2, 3), obj(3), "increment"), []);
    assert.deepEqual(reorderElements(stack(-3, -2, -1), obj(1), "decrement"), []);
  });

  it("reports no change for a target it does not hold", () => {
    assert.deepEqual(reorderElements(stack(1, 2), obj(99), "top"), []);
  });

  it("steps an all-unranked mask exactly as it steps a ranked one, and ranks it on the way", () => {
    const legacy = stack(0, 0, 0);
    assert.deepEqual(orderOfIds(legacy, 1, "increment"), [2, 1, 3]);
    assert.deepEqual(after(legacy, 1, "increment"), [1, 2, 3]);
  });

  it("carries the plane across a move that does not involve it", () => {
    const objects = [
      { kind: "object" as const, id: 1, order: -2 },
      { kind: "object" as const, id: 2, order: -1 },
      { kind: "object" as const, id: 3, order: 1 },
      { kind: "object" as const, id: 4, order: 2 },
    ];
    const changes = new Map(reorderElements(objects, obj(3), "increment").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), undefined);
    assert.equal(changes.get(2), undefined);
    assert.deepEqual(after(objects, 3, "increment"), [-2, -1, 1, 2]);
    assert.deepEqual(orderOfIds(objects, 3, "increment"), [1, 2, 4, 3]);
  });

  it("reports only the objects whose order actually moved", () => {
    assert.deepEqual(
      reorderElements(stack(1, 2, 3, 4), obj(1), "increment").map((c) => c.id),
      [2, 1],
    );
  });

  it("walks one object all the way through the stack and back", () => {
    let objects = stack(1, 2, 3);
    const seen: number[][] = [];
    for (let step = 0; step < 4; step++) {
      const changes = new Map(reorderElements(objects, obj(1), "decrement").map((c) => [c.id, c.order]));
      objects = objects.map((o) => ({ ...o, order: changes.get(o.id) ?? o.order }));
      seen.push(stackedElements(objects).map((o) => o.id));
    }

    assert.deepEqual(seen, [
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    assert.equal(objects.find((o) => o.id === 1)?.order, -1);
  });
});

describe("frontElementOrder", () => {
  it("puts a new object in front of everything on the mask", () => {
    assert.equal(frontElementOrder(stack(-2, -1, 1, 2)), 3);
  });

  it("gives the first object on an unranked mask a real order", () => {
    assert.equal(frontElementOrder(stack(0, 0)), 1);
  });

  it("gives the first object on an empty mask the front slot", () => {
    assert.equal(frontElementOrder([]), 1);
  });

  it("stays in front even when every object is behind the mask", () => {
    assert.equal(frontElementOrder(stack(-3, -2, -1)), 1);
  });
});

describe("isBehindMask", () => {
  it("reads the sign, and the sheet itself is not behind anything", () => {
    assert.equal(isBehindMask({ order: -1 }), true);
    assert.equal(isBehindMask({ order: 0 }), false);
    assert.equal(isBehindMask({ order: 1 }), false);
  });
});

describe("frontToBackElements", () => {
  it("reads the stack topmost first, which is the reverse of the ranking", () => {
    assert.deepEqual(
      frontToBackElements(stack(-1, 1, 2)).map((o) => o.order),
      [2, 1, -1],
    );
  });

  it("does not mutate its input", () => {
    const objects = stack(1, 2, 3);
    frontToBackElements(objects);
    assert.deepEqual(
      objects.map((o) => o.order),
      [1, 2, 3],
    );
  });
});

describe("frontToBackDividerIndex", () => {
  it("counts the rows in front of the sheet", () => {
    assert.equal(frontToBackDividerIndex(stack(-2, -1, 1, 2, 3)), 3);
  });

  it("puts the sheet at the bottom when everything is in front of it", () => {
    assert.equal(frontToBackDividerIndex(stack(1, 2)), 2);
  });

  it("puts the sheet at the top when everything is behind it", () => {
    assert.equal(frontToBackDividerIndex(stack(-2, -1)), 0);
  });

  it("treats an unranked object as in front, the way isBehindMask does", () => {
    assert.equal(frontToBackDividerIndex(stack(0, 0)), 2);
  });
});

describe("restackElements", () => {
  function landed(objects: StackedElement[], ids: number[], divider: number): number[] {
    const changes = new Map(restackElements(objects, ids.map(obj), divider).map((c) => [c.id, c.order]));
    const held = new Map(objects.map((o) => [o.id, o]));
    return ids.map((id) => changes.get(id) ?? held.get(id)?.order ?? NaN);
  }

  it("ranks a sequence exactly the way a stepped reorder ranks one", () => {
    assert.deepEqual(landed(stack(0, 0, 0), [3, 2, 1], 3), [3, 2, 1]);
  });

  it("leaves no object on the mask's own plane", () => {
    const orders = landed(stack(1, 2, 3, 4), [4, 3, 2, 1], 2);
    assert.equal(orders.includes(0), false, JSON.stringify(orders));
  });

  it("counts down to the sheet in front and away from it behind", () => {
    assert.deepEqual(landed(stack(1, 2, 3, 4), [4, 3, 2, 1], 2), [2, 1, -1, -2]);
  });

  it("sends everything behind the mask when the divider is at the top", () => {
    assert.deepEqual(landed(stack(1, 2), [2, 1], 0), [-1, -2]);
  });

  it("brings everything in front when the divider is at the bottom", () => {
    assert.deepEqual(landed(stack(-2, -1), [2, 1], 2), [2, 1]);
  });

  it("reports only the objects whose order actually moved", () => {
    assert.deepEqual(restackElements(stack(1, 2, 3), [3, 2, 1].map(obj), 3), []);
  });

  it("agrees with a stepped reorder that produces the same sequence", () => {
    const objects = stack(1, 2, 3);
    const stepped = new Map(reorderElements(objects, obj(1), "increment").map((c) => [c.id, c.order]));
    const dropped = new Map(restackElements(objects, [3, 1, 2].map(obj), 3).map((c) => [c.id, c.order]));
    assert.deepEqual([...stepped.entries()].sort(), [...dropped.entries()].sort());
  });

  it("round-trips through the reading it is meant to be handed", () => {
    const objects = stack(-2, -1, 1, 2);
    const ids = frontToBackElements(objects).map((o) => o.id);
    assert.deepEqual(restackElements(objects, ids.map(obj), frontToBackDividerIndex(objects)), []);
  });

  it("ignores an id the mask does not hold", () => {
    assert.deepEqual(restackElements(stack(1), [99, 1].map(obj), 2), []);
  });
});

describe("stackRows", () => {
  it("splices the plane in where the sign changes", () => {
    assert.deepEqual(rowIds(stackRows(stack(-1, 1, 2))), [3, 2, MASK_PLANE_ROW, 1]);
  });

  it("puts the plane last when every object is in front of it", () => {
    assert.deepEqual(rowIds(stackRows(stack(1, 2))), [2, 1, MASK_PLANE_ROW]);
  });

  it("puts the plane first when every object is behind it", () => {
    assert.deepEqual(rowIds(stackRows(stack(-2, -1))), [MASK_PLANE_ROW, 2, 1]);
  });

  it("gives a mask with no objects just the plane", () => {
    assert.deepEqual(rowIds(stackRows([])), [MASK_PLANE_ROW]);
  });
});

describe("restackFromDrop", () => {
  function dropped(objects: StackedElement[], from: number, to: number): Map<number, number> {
    const rows = stackRows(objects);
    const changes = new Map(restackFromDrop(objects, rows, from, to).map((c) => [c.id, c.order]));
    return new Map(objects.map((o) => [o.id, changes.get(o.id) ?? o.order]));
  }

  it("sends an object behind the mask when it is dropped onto the plane row", () => {
    const objects = stack(1, 2);
    const after = dropped(objects, 1, 2);
    assert.equal(after.get(1), -1);
    assert.equal(after.get(2), 1);
  });

  it("brings an object back in front when it is dropped onto the plane from below", () => {
    const objects = stack(-1, 1);
    const after = dropped(objects, 2, 1);
    assert.equal(after.get(1), 1);
    assert.equal(after.get(2), 2);
  });

  it("reorders within the front stack without changing anyone's side", () => {
    const objects = stack(1, 2, 3);
    const after = dropped(objects, 0, 1);
    assert.deepEqual(
      [...after.values()].filter((o) => o < 0),
      [],
    );
    assert.equal(after.get(2), 3);
    assert.equal(after.get(3), 2);
  });

  it("reorders within the behind stack without bringing anything forward", () => {
    const objects = stack(-3, -2, -1);
    const after = dropped(objects, 1, 3);
    assert.deepEqual(
      [...after.values()].filter((o) => o >= 0),
      [],
    );
  });

  it("never lands an object on the plane itself", () => {
    const objects = stack(-2, -1, 1, 2, 3);
    const rows = stackRows(objects);
    for (let from = 0; from < rows.length; from++) {
      for (let to = 0; to < rows.length; to++) {
        const changes = restackFromDrop(objects, rows, from, to);
        assert.equal(
          changes.some((c) => c.order === 0),
          false,
          `drop ${from} -> ${to} put an object on the plane`,
        );
      }
    }
  });

  it("is a no-op when a row is dropped where it already was", () => {
    const objects = stack(-1, 1, 2);
    const rows = stackRows(objects);
    for (let i = 0; i < rows.length; i++) {
      assert.deepEqual(restackFromDrop(objects, rows, i, i), [], `row ${i}`);
    }
  });

  it("pushes objects behind the mask when the plane itself is dragged up", () => {
    const objects = stack(1, 2, 3);
    const rows = stackRows(objects);
    const after = dropped(objects, 3, 1);
    assert.equal(rows[3], MASK_PLANE_ROW);
    assert.equal(after.get(3), 1);
    assert.equal(after.get(2), -1);
    assert.equal(after.get(1), -2);
  });

  it("brings objects back in front when the plane is dragged down", () => {
    const objects = stack(-2, -1, 1);
    const after = dropped(objects, 1, 3);
    assert.deepEqual(
      [...after.values()].filter((o) => o < 0),
      [],
    );
  });

  it("sends every object behind the mask when the plane is dragged to the top", () => {
    const objects = stack(1, 2, 3);
    const after = dropped(objects, 3, 0);
    assert.deepEqual([after.get(1), after.get(2), after.get(3)], [-3, -2, -1]);
  });

  it("refuses an index outside the list", () => {
    const objects = stack(1, 2);
    const rows = stackRows(objects);
    assert.deepEqual(restackFromDrop(objects, rows, -1, 0), []);
    assert.deepEqual(restackFromDrop(objects, rows, 0, rows.length), []);
  });

  it("refuses a row list with no plane in it, rather than guessing the boundary", () => {
    assert.deepEqual(restackFromDrop(stack(1, 2), [obj(2), obj(1)], 0, 1), []);
  });

  it("ranks an unranked mask on the first drop", () => {
    const legacy = stack(0, 0, 0);
    const after = dropped(legacy, 0, 2);
    assert.deepEqual([after.get(1), after.get(2), after.get(3)], [2, 3, 1]);
  });
});

describe("maskStack", () => {
  it("reads a mask's two lists as the one stack they are", () => {
    const stack = maskStack({
      objects: [{ id: 1, order: 2 }],
      lights: [{ id: 1, order: -1 }],
    });
    assert.deepEqual(stackedElements(stack), [
      { kind: "light", id: 1, order: -1 },
      { kind: "object", id: 1, order: 2 },
    ]);
  });

  it("keeps object 1 and light 1 apart, since they are different cards", () => {
    const stack = maskStack({ objects: [{ id: 1, order: 0 }], lights: [{ id: 1, order: 0 }] });
    assert.equal(stack.length, 2);
    assert.deepEqual(
      stackedElements(stack).map((e) => e.kind),
      ["object", "light"],
    );
  });
});

describe("occludes", () => {
  it("blocks a light that ranks below the object", () => {
    assert.equal(occludes(2, 1), true);
    assert.equal(occludes(1, -1), true);
  });

  it("does not block a light that ranks above the object, or level with it", () => {
    assert.equal(occludes(1, 2), false);
    assert.equal(occludes(1, 1), false);
    assert.equal(occludes(-1, 1), false);
  });

  it("never blocks an unranked light, whatever the object holds", () => {
    assert.equal(occludes(3, 0), false);
    assert.equal(occludes(-3, 0), false);
  });
});

describe("a stack holding both kinds", () => {
  function mixed(): StackedElement[] {
    return [
      { kind: "object", id: 1, order: 1 },
      { kind: "light", id: 1, order: 2 },
      { kind: "object", id: 2, order: 3 },
    ];
  }

  it("steps a light through the stack the way it steps an object", () => {
    const changes = reorderElements(mixed(), light(1), "increment");
    assert.deepEqual(changes, [
      { kind: "object", id: 2, order: 2 },
      { kind: "light", id: 1, order: 3 },
    ]);
  });

  it("sends a light behind the sheet, where it stops reaching anything but the gaps", () => {
    const elements = mixed();
    const changes = new Map(reorderElements(elements, light(1), "bottom").map((c) => [`${c.kind}:${c.id}`, c.order]));
    const landed = new Map(elements.map((e) => [`${e.kind}:${e.id}`, changes.get(`${e.kind}:${e.id}`) ?? e.order]));
    assert.deepEqual([landed.get("light:1"), landed.get("object:1"), landed.get("object:2")], [-1, 1, 2]);
    assert.equal(changes.has("object:1"), false);
  });

  it("renumbers both kinds in one reorder, so a mask ranks whole or not at all", () => {
    const legacy = maskStack({
      objects: [
        { id: 1, order: 0 },
        { id: 2, order: 0 },
      ],
      lights: [{ id: 1, order: 0 }],
    });
    const changes = reorderElements(legacy, light(1), "bottom");
    assert.deepEqual(changes.map((c) => c.kind).sort(), ["light", "object", "object"]);
    assert.equal(
      changes.some((c) => c.order === 0),
      false,
    );
  });

  it("lists an unranked light in front of the unranked objects, matching what is drawn", () => {
    const legacy = maskStack({ objects: [{ id: 1, order: 0 }], lights: [{ id: 1, order: 0 }] });
    assert.deepEqual(rowIds(stackRows(legacy)), [1, 1, MASK_PLANE_ROW]);
    assert.deepEqual(
      stackRows(legacy)
        .filter((row): row is StackRef => row !== MASK_PLANE_ROW)
        .map((row) => row.kind),
      ["light", "object"],
    );
  });

  it("drops a light onto the plane row to send it behind the sheet", () => {
    const elements = mixed();
    const rows = stackRows(elements);
    const from = rows.findIndex((row) => row !== MASK_PLANE_ROW && row.kind === "light");
    const changes = new Map(
      restackFromDrop(elements, rows, from, rows.length - 1).map((c) => [`${c.kind}:${c.id}`, c.order]),
    );
    assert.equal(changes.get("light:1"), -1);
  });

  it("moves an object without disturbing a light that is not in its way", () => {
    const elements = mixed();
    const changes = reorderElements(elements, obj(1), "top");
    assert.deepEqual(
      changes.map((c) => `${c.kind}:${c.id}`),
      ["light:1", "object:2", "object:1"],
    );
  });
});
