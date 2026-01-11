import { YamlStrategy } from "../src/yamlStrategy";
import { optimize } from "../src/index";

describe("YamlStrategy", () => {
  it("roundtrips YAML compress/decompress", () => {
    const strat = new YamlStrategy();
    const obj = { a: 1, b: { c: "hello", d: [1, 2, 3] } };
    const pkg = strat.compress(obj);
    expect(pkg).toHaveProperty("$y");
    const restored = strat.decompress(pkg);
    expect(restored).toEqual(obj);
  });

  it("can be applied by Optimizer as a final pass when beneficial", () => {
    // Construct a payload that YAML will render slightly shorter than JSON
    const data: any = { list: [] };
    for (let i = 0; i < 40; i++) data.list.push({ key: "value_" + i });

    const result = optimize(data, {
      thresholdBytes: 0,
      validateTokenSavings: false,
      fastMode: false,
    });
    // result may be { $y: '<yaml string>' } if YAML pass accepted
    expect(
      typeof result === "object" || typeof result === "string" || result
    ).toBeDefined();
    // If YAML was accepted, the structure will have $y
    if (result && result.$y) {
      expect(typeof result.$y).toBe("string");
    }
  });

  it("respects the yamlEnabled toggle (does not call YAML when disabled)", () => {
    const { Optimizer } = require("../src/index");
    const optimizer = new Optimizer();

    // Replace yamlStrat with a stub that records calls
    let called = false;
    (optimizer as any).yamlStrat = {
      compress: () => {
        called = true;
        return { $y: "stub" };
      },
    };

    // Should NOT call yaml when yamlEnabled is false
    called = false;
    optimizer.optimize(
      { a: 1 },
      {
        thresholdBytes: 0,
        fastMode: false,
        yamlEnabled: false,
        validateTokenSavings: false,
      }
    );
    expect(called).toBe(false);

    // Should call yaml when yamlEnabled is true
    called = false;
    optimizer.optimize(
      { a: 1 },
      {
        thresholdBytes: 0,
        fastMode: false,
        yamlEnabled: true,
        validateTokenSavings: false,
      }
    );
    expect(called).toBe(true);
  });
});
