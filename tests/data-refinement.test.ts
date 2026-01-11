import { refineData } from "../src/dataRefinement";
import { Optimizer } from "../src/optimizer";

describe("Data Refinement", () => {
  it("rounds floats to specified precision", () => {
    const input = { a: 3.14159, b: 2.71828 };
    const out = refineData(input, {
      precision: 2,
      pruneEmpty: false,
      pruneNull: false,
    });
    expect(out.a).toBe(3.14);
    expect(out.b).toBe(2.72);
  });

  it("prunes empty values when enabled", () => {
    const input = { a: null, b: "", c: [], d: {}, e: 0, f: "ok" };
    const out = refineData(input, {
      precision: 2,
      pruneEmpty: true,
      pruneNull: true,
    });
    expect(out).toEqual({ e: 0, f: "ok" });
  });

  it("integrates with Optimizer when enabled", () => {
    const optimizer = new Optimizer();
    const data = { value: 1.23456, empty: "", nested: { v: 9.8765, arr: [] } };
    const result = optimizer.optimize(data, {
      thresholdBytes: 0,
      dataRefinement: { enabled: true, precision: 1, pruneEmpty: true },
    });
    // The optimized output should have the rounded number (1.2) somewhere in the stringified form
    expect(JSON.stringify(result)).toContain("1.2");
    // Empty fields should be pruned
    expect(JSON.stringify(result)).not.toContain('"empty"');
  });
});
