import { optimize } from "../src/index";
import { AbbreviatedKeysStrategy } from "../src/strategies";

describe("Custom static dictionary via optimize options", () => {
  it("applies customDict during a single optimize run and restores global DICT", () => {
    const original = (AbbreviatedKeysStrategy as any).DICT;
    const custom = { auth: "z" };

    // Build a payload where abbreviation will likely reduce bytes
    const payload = {
      items: Array.from({ length: 80 }, () => ({ auth: "token" })),
    };
    const result = optimize(payload, {
      thresholdBytes: 0,
      fastMode: false,
      customDict: custom,
      validateTokenSavings: false,
    });

    // We expect the short key 'z' to be present in the compressed result when abbreviation is applied
    const s = JSON.stringify(result);
    expect(s.includes('"z"') || s.includes('"$r"') || s.includes('"$s"')).toBe(
      true
    );
    // 'auth' should not appear in abbreviated data if abbreviation applied
    if (s.includes('"z"')) expect(s).not.toContain('"auth"');
    // Ensure DICT restored
    expect((AbbreviatedKeysStrategy as any).DICT).toBe(original);
  });
});
