import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(new URL("../app.module.css", import.meta.url), "utf8");
const client = readFileSync(new URL("./metrics.client.tsx", import.meta.url), "utf8");

function layouts(): string[][][] {
  const blocks = [...css.matchAll(/grid-template-areas:([^;]*);/g)];
  return blocks.map((block) => [...block[1].matchAll(/"([^"]*)"/g)].map((row) => row[1].trim().split(/\s+/)));
}

function placed(): Set<string> {
  return new Set([...client.matchAll(/gridArea:\s*"([^"]+)"/g)].map((m) => m[1]));
}

describe("the metrics panel grid", () => {
  it("declares a layout for every breakpoint", () => {
    assert.equal(layouts().length, 3, "expected wide, medium and narrow layouts");
  });

  it("never leaves a cell unnamed, so no width can open a hole", () => {
    for (const rows of layouts()) {
      for (const row of rows) {
        assert.ok(!row.includes("."), `a layout row leaves an empty cell: ${row.join(" ")}`);
      }
    }
  });

  it("keeps every row the same width", () => {
    for (const rows of layouts()) {
      const widths = new Set(rows.map((row) => row.length));
      assert.equal(widths.size, 1, `ragged layout: ${rows.map((r) => r.length).join(",")}`);
    }
  });

  it("keeps every area rectangular, or the browser drops the whole declaration", () => {
    for (const rows of layouts()) {
      const cells = new Map<string, { row: number; col: number }[]>();
      rows.forEach((row, rowIndex) =>
        row.forEach((name, colIndex) => {
          const held = cells.get(name) ?? [];
          held.push({ row: rowIndex, col: colIndex });
          cells.set(name, held);
        }),
      );
      for (const [name, spots] of cells) {
        const rowSpan = Math.max(...spots.map((s) => s.row)) - Math.min(...spots.map((s) => s.row)) + 1;
        const colSpan = Math.max(...spots.map((s) => s.col)) - Math.min(...spots.map((s) => s.col)) + 1;
        assert.equal(
          spots.length,
          rowSpan * colSpan,
          `"${name}" is not a rectangle (${spots.length} cells in a ${rowSpan}x${colSpan} box)`,
        );
      }
    }
  });

  it("places every panel in every layout", () => {
    const panels = placed();
    assert.ok(panels.size > 0, "no gridArea assignments found");
    for (const rows of layouts()) {
      const named = new Set(rows.flat());
      assert.deepEqual(
        [...panels].sort(),
        [...named].sort(),
        "a panel is missing from a layout, or a layout names an area no panel uses",
      );
    }
  });

  it("spans a panel rather than shrinking the column count to fit", () => {
    const [wide] = layouts();
    const spans = wide.flat().filter((name, index, all) => all.indexOf(name) !== index);
    assert.ok(spans.length > 0, "the wide layout should span at least one panel");
  });
});
