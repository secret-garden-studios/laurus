import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  frontObjectOrder,
  frontToBackDividerIndex,
  frontToBackObjects,
  isBehindMask,
  reorderObjects,
  restackFromDrop,
  restackObjects,
  stackRows,
  stackedObjects,
  MASK_PLANE_ROW,
  type ObjectOrderDirection,
  type StackedObject,
} from "./object-order.ts";

function stack(...orders: number[]): StackedObject[] {
  return orders.map((order, index) => ({ id: index + 1, order }));
}

/** The stack after one reorder, back to front, as the orders it now holds. */
function after(objects: StackedObject[], targetId: number, direction: ObjectOrderDirection): number[] {
  const changes = new Map(reorderObjects(objects, targetId, direction).map((c) => [c.id, c.order]));
  const applied = objects.map((object) => ({ ...object, order: changes.get(object.id) ?? object.order }));
  return stackedObjects(applied).map((object) => object.order);
}

/** Which ids the stack holds, back to front, after one reorder. */
function orderOfIds(objects: StackedObject[], targetId: number, direction: ObjectOrderDirection): number[] {
  const changes = new Map(reorderObjects(objects, targetId, direction).map((c) => [c.id, c.order]));
  const applied = objects.map((object) => ({ ...object, order: changes.get(object.id) ?? object.order }));
  return stackedObjects(applied).map((object) => object.id);
}

describe("stackedObjects", () => {
  it("ranks back to front by order", () => {
    assert.deepEqual(
      stackedObjects(stack(2, -1, 1)).map((o) => o.order),
      [-1, 1, 2],
    );
  });

  it("breaks a run of unranked objects by id, so a legacy mask keeps its stacking", () => {
    const legacy = [
      { id: 7, order: 0 },
      { id: 2, order: 0 },
      { id: 5, order: 0 },
    ];
    assert.deepEqual(
      stackedObjects(legacy).map((o) => o.id),
      [2, 5, 7],
    );
  });

  it("does not mutate its input", () => {
    const objects = stack(3, 1, 2);
    stackedObjects(objects);
    assert.deepEqual(
      objects.map((o) => o.order),
      [3, 1, 2],
    );
  });
});

describe("reorderObjects", () => {
  it("leaves no object on the mask's own plane", () => {
    for (const direction of ["increment", "decrement", "top", "bottom"] as const) {
      const orders = after(stack(-2, -1, 1, 2, 3), 3, direction);
      assert.equal(orders.includes(0), false, `${direction} put an object on the sheet: ${JSON.stringify(orders)}`);
    }
  });

  it("ranks densely around the sheet", () => {
    // one behind, two in front -- the example the field is documented with
    assert.deepEqual(after(stack(0, 0, 0), 1, "bottom"), [-1, 1, 2]);
  });

  it("swaps with the next object up, within the front stack", () => {
    assert.deepEqual(orderOfIds(stack(1, 2, 3), 1, "increment"), [2, 1, 3]);
  });

  it("swaps with the next object down, within the front stack", () => {
    assert.deepEqual(orderOfIds(stack(1, 2, 3), 3, "decrement"), [1, 3, 2]);
  });

  it("crosses the sheet without changing places with any object", () => {
    // id 2 is the frontmost of the two behind the mask; stepping up puts it in
    // front of the sheet but still behind id 3
    const objects = [
      { id: 1, order: -2 },
      { id: 2, order: -1 },
      { id: 3, order: 1 },
    ];
    const changes = new Map(reorderObjects(objects, 2, "increment").map((c) => [c.id, c.order]));
    assert.equal(changes.get(2), 1);
    assert.equal(changes.get(3), 2);
    assert.equal(changes.get(1), -1);
  });

  it("sinks the backmost front object behind the sheet", () => {
    const objects = [
      { id: 1, order: 1 },
      { id: 2, order: 2 },
    ];
    const changes = new Map(reorderObjects(objects, 1, "decrement").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), -1);
    assert.equal(changes.get(2), 1);
  });

  it("sends a lone object behind the mask and brings it back", () => {
    const alone = [{ id: 1, order: 1 }];
    assert.deepEqual(reorderObjects(alone, 1, "decrement"), [{ id: 1, order: -1 }]);
    assert.deepEqual(reorderObjects([{ id: 1, order: -1 }], 1, "increment"), [{ id: 1, order: 1 }]);
  });

  it("moves to the front of everything, which is in front of the mask", () => {
    const objects = [
      { id: 1, order: -2 },
      { id: 2, order: -1 },
      { id: 3, order: 1 },
    ];
    assert.deepEqual(orderOfIds(objects, 1, "top"), [2, 3, 1]);
    const changes = new Map(reorderObjects(objects, 1, "top").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), 2);
  });

  it("moves to the back of everything, which is behind the mask", () => {
    const objects = stack(1, 2, 3);
    assert.deepEqual(orderOfIds(objects, 3, "bottom"), [3, 1, 2]);
    const changes = new Map(reorderObjects(objects, 3, "bottom").map((c) => [c.id, c.order]));
    assert.equal(changes.get(3), -1);
  });

  it("refuses to step past either end", () => {
    assert.deepEqual(reorderObjects(stack(1, 2, 3), 3, "increment"), []);
    assert.deepEqual(reorderObjects(stack(-3, -2, -1), 1, "decrement"), []);
  });

  it("reports no change for a target it does not hold", () => {
    assert.deepEqual(reorderObjects(stack(1, 2), 99, "top"), []);
  });

  it("steps an all-unranked mask exactly as it steps a ranked one, and ranks it on the way", () => {
    const legacy = stack(0, 0, 0);
    assert.deepEqual(orderOfIds(legacy, 1, "increment"), [2, 1, 3]);
    assert.deepEqual(after(legacy, 1, "increment"), [1, 2, 3]);
  });

  it("carries the plane across a move that does not involve it", () => {
    // ids 1 and 2 are behind the mask; reordering two objects in front must
    // leave both of them there
    const objects = [
      { id: 1, order: -2 },
      { id: 2, order: -1 },
      { id: 3, order: 1 },
      { id: 4, order: 2 },
    ];
    const changes = new Map(reorderObjects(objects, 3, "increment").map((c) => [c.id, c.order]));
    assert.equal(changes.get(1), undefined);
    assert.equal(changes.get(2), undefined);
    assert.deepEqual(after(objects, 3, "increment"), [-2, -1, 1, 2]);
    assert.deepEqual(orderOfIds(objects, 3, "increment"), [1, 2, 4, 3]);
  });

  it("reports only the objects whose order actually moved", () => {
    assert.deepEqual(
      reorderObjects(stack(1, 2, 3, 4), 1, "increment").map((c) => c.id),
      [2, 1],
    );
  });

  it("walks one object all the way through the stack and back", () => {
    let objects = stack(1, 2, 3);
    const seen: number[][] = [];
    for (let step = 0; step < 4; step++) {
      const changes = new Map(reorderObjects(objects, 1, "decrement").map((c) => [c.id, c.order]));
      objects = objects.map((o) => ({ ...o, order: changes.get(o.id) ?? o.order }));
      seen.push(stackedObjects(objects).map((o) => o.id));
    }
    // first step sinks it behind the sheet, and then there is nowhere left to go
    assert.deepEqual(seen, [
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    assert.equal(objects.find((o) => o.id === 1)?.order, -1);
  });
});

describe("frontObjectOrder", () => {
  it("puts a new object in front of everything on the mask", () => {
    assert.equal(frontObjectOrder(stack(-2, -1, 1, 2)), 3);
  });

  it("gives the first object on an unranked mask a real order", () => {
    assert.equal(frontObjectOrder(stack(0, 0)), 1);
  });

  it("gives the first object on an empty mask the front slot", () => {
    assert.equal(frontObjectOrder([]), 1);
  });

  it("stays in front even when every object is behind the mask", () => {
    assert.equal(frontObjectOrder(stack(-3, -2, -1)), 1);
  });
});

describe("isBehindMask", () => {
  it("reads the sign, and the sheet itself is not behind anything", () => {
    assert.equal(isBehindMask({ order: -1 }), true);
    assert.equal(isBehindMask({ order: 0 }), false);
    assert.equal(isBehindMask({ order: 1 }), false);
  });
});

describe("frontToBackObjects", () => {
  it("reads the stack topmost first, which is the reverse of the ranking", () => {
    assert.deepEqual(
      frontToBackObjects(stack(-1, 1, 2)).map((o) => o.order),
      [2, 1, -1],
    );
  });

  it("does not mutate its input", () => {
    const objects = stack(1, 2, 3);
    frontToBackObjects(objects);
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

describe("restackObjects", () => {
  /** The orders a front-to-back drop produces, in the same front-to-back order. */
  function landed(objects: StackedObject[], ids: number[], divider: number): number[] {
    const changes = new Map(restackObjects(objects, ids, divider).map((c) => [c.id, c.order]));
    const held = new Map(objects.map((o) => [o.id, o]));
    return ids.map((id) => changes.get(id) ?? held.get(id)?.order ?? NaN);
  }

  it("ranks a sequence exactly the way a stepped reorder ranks one", () => {
    // ids 1..3 front-to-back with the sheet under all of them
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
    // already ranked 3,2,1 front-to-back with the sheet below; nothing moves
    assert.deepEqual(restackObjects(stack(1, 2, 3), [3, 2, 1], 3), []);
  });

  it("agrees with a stepped reorder that produces the same sequence", () => {
    const objects = stack(1, 2, 3);
    const stepped = new Map(reorderObjects(objects, 1, "increment").map((c) => [c.id, c.order]));
    // the same move expressed as a drop: id 1 swaps in front of id 2
    const dropped = new Map(restackObjects(objects, [3, 1, 2], 3).map((c) => [c.id, c.order]));
    assert.deepEqual([...stepped.entries()].sort(), [...dropped.entries()].sort());
  });

  it("round-trips through the reading it is meant to be handed", () => {
    const objects = stack(-2, -1, 1, 2);
    const ids = frontToBackObjects(objects).map((o) => o.id);
    assert.deepEqual(restackObjects(objects, ids, frontToBackDividerIndex(objects)), []);
  });

  it("ignores an id the mask does not hold", () => {
    assert.deepEqual(restackObjects(stack(1), [99, 1], 2), []);
  });
});

describe("stackRows", () => {
  it("splices the plane in where the sign changes", () => {
    assert.deepEqual(stackRows(stack(-1, 1, 2)), [3, 2, MASK_PLANE_ROW, 1]);
  });

  it("puts the plane last when every object is in front of it", () => {
    assert.deepEqual(stackRows(stack(1, 2)), [2, 1, MASK_PLANE_ROW]);
  });

  it("puts the plane first when every object is behind it", () => {
    assert.deepEqual(stackRows(stack(-2, -1)), [MASK_PLANE_ROW, 2, 1]);
  });

  it("gives a mask with no objects just the plane", () => {
    assert.deepEqual(stackRows([]), [MASK_PLANE_ROW]);
  });
});

describe("restackFromDrop", () => {
  /** The order each object holds after one drop, keyed by id. */
  function dropped(objects: StackedObject[], from: number, to: number): Map<number, number> {
    const rows = stackRows(objects);
    const changes = new Map(restackFromDrop(objects, rows, from, to).map((c) => [c.id, c.order]));
    return new Map(objects.map((o) => [o.id, changes.get(o.id) ?? o.order]));
  }

  it("sends an object behind the mask when it is dropped onto the plane row", () => {
    // ids 1,2 both in front -- rows are [2, 1, plane], so the plane is the only
    // row below id 1 and dropping onto it is the whole gesture
    const objects = stack(1, 2);
    const after = dropped(objects, 1, 2);
    assert.equal(after.get(1), -1);
    assert.equal(after.get(2), 1);
  });

  it("brings an object back in front when it is dropped onto the plane from below", () => {
    // rows for (-1, 1) are [2, plane, 1]
    const objects = stack(-1, 1);
    const after = dropped(objects, 2, 1);
    assert.equal(after.get(1), 1);
    assert.equal(after.get(2), 2);
  });

  it("reorders within the front stack without changing anyone's side", () => {
    const objects = stack(1, 2, 3);
    const after = dropped(objects, 0, 1); // rows [3,2,1,plane]; move id 3 down one
    assert.deepEqual(
      [...after.values()].filter((o) => o < 0),
      [],
    );
    assert.equal(after.get(2), 3);
    assert.equal(after.get(3), 2);
  });

  it("reorders within the behind stack without bringing anything forward", () => {
    const objects = stack(-3, -2, -1); // rows [plane, 3, 2, 1]
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
    // every object in front, so the plane is the last row -- dragging it up two
    // is the way to send the two objects it passes behind the mask
    const objects = stack(1, 2, 3);
    const rows = stackRows(objects); // [3, 2, 1, plane]
    const after = dropped(objects, 3, 1);
    assert.equal(rows[3], MASK_PLANE_ROW);
    assert.equal(after.get(3), 1); // stayed in front
    assert.equal(after.get(2), -1); // the plane passed it
    assert.equal(after.get(1), -2);
  });

  it("brings objects back in front when the plane is dragged down", () => {
    const objects = stack(-2, -1, 1); // rows [3, plane, 2, 1]
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
    assert.deepEqual(restackFromDrop(stack(1, 2), [2, 1], 0, 1), []);
  });

  it("ranks an unranked mask on the first drop", () => {
    // rows are [3, 2, 1, plane]: all three tie at 0, so the id tie-break ranks
    // them 1,2,3 back-to-front and the reading reverses that. Dragging the top
    // row down two lands the sequence 2,1,3 front-to-back, which is orders
    // 3,2,1 -- and every object on the mask now holds a real one.
    const legacy = stack(0, 0, 0);
    const after = dropped(legacy, 0, 2);
    assert.deepEqual([after.get(1), after.get(2), after.get(3)], [2, 3, 1]);
  });
});
