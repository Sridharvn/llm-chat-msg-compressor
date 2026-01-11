import { StructuralDeduplicationStrategy } from "../src/strategies";

describe("Structural Deduplication Strategy", () => {
  it("should detect repeated large sub-objects and replace with registry refs", () => {
    const repeated = { long: "x".repeat(100), nested: { a: 1, b: 2 } };
    const data = {
      items: [repeated, { other: 1 }, repeated, { other: 2 }, repeated],
    };

    const strat = new StructuralDeduplicationStrategy({ minSizeBytes: 50 });
    const compressed = strat.compress(data);

    expect(compressed).toHaveProperty("$r");
    expect(compressed).toHaveProperty("d");
    // registry should have at least one entry
    expect(Object.keys(compressed.$r).length).toBeGreaterThan(0);

    const restored = strat.decompress(compressed);
    expect(restored).toEqual(data);
  });

  it("should return original data if no candidate qualifies", () => {
    const small = { a: 1 };
    const data = { items: [small, { b: 2 }] };
    const strat = new StructuralDeduplicationStrategy({ minSizeBytes: 1024 });
    const compressed = strat.compress(data);
    expect(compressed).toEqual(data);
  });
});
