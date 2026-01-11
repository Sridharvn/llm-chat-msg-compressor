import { optimize } from "../src/index";
import { TokenCounter } from "../src/tokenizer";

const runs = 3;
const tokenizer = "cl100k_base";

const payloads: Record<string, any> = {
  small: { messages: [{ role: "user", content: "Hello" }] },
  repeated: (() => {
    const r = { long: "x".repeat(300), meta: { t: 1 } };
    return { items: [r, r, r, { other: 1 }, r, r] };
  })(),
  numeric: { values: Array.from({ length: 200 }, (_, i) => Math.PI * (i + 1)) },
  mixed: (() => {
    const arr: any[] = [];
    for (let i = 0; i < 200; i++)
      arr.push({ id: i, text: "value_" + i, flag: i % 2 === 0 });
    return { data: arr };
  })(),
};

const configs = [
  { name: "baseline", opts: { validateTokenSavings: false } },
  { name: "default-optimize", opts: { thresholdBytes: 0 } },
  {
    name: "data-refine",
    opts: {
      thresholdBytes: 0,
      dataRefinement: { enabled: true, precision: 2 },
    },
  },
  {
    name: "yaml-enabled",
    opts: { thresholdBytes: 0, yamlEnabled: true, validateTokenSavings: false },
  },
  {
    name: "yaml-disabled",
    opts: {
      thresholdBytes: 0,
      yamlEnabled: false,
      validateTokenSavings: false,
    },
  },
  {
    name: "custom-dict",
    opts: {
      thresholdBytes: 0,
      customDict: { auth: "a", message: "b" },
      validateTokenSavings: false,
    },
  },
];

const measureBytes = (obj: any) =>
  Buffer.byteLength(JSON.stringify(obj), "utf8");
const measureTokens = (obj: any) => TokenCounter.count(obj, tokenizer);

const runSingle = (payload: any, config: any) => {
  const beforeBytes = measureBytes(payload);
  const beforeTokens = measureTokens(payload);
  const start = Date.now();
  const optimized =
    config.name === "baseline" ? payload : optimize(payload, config.opts);
  const dur = Date.now() - start;
  const afterBytes = measureBytes(optimized);
  const afterTokens = measureTokens(optimized);
  return { optimized, beforeBytes, afterBytes, beforeTokens, afterTokens, dur };
};

const printRow = (label: string, res: any) => {
  const bGain = ((res.beforeBytes - res.afterBytes) / res.beforeBytes) * 100;
  const tGain = ((res.beforeTokens - res.afterTokens) / res.beforeTokens) * 100;
  console.log(
    `${label.padEnd(18)} | bytes ${res.beforeBytes}->${
      res.afterBytes
    } (${bGain.toFixed(1)}%) | tokens ${res.beforeTokens}->${
      res.afterTokens
    } (${tGain.toFixed(1)}%) | ${res.dur}ms`
  );
};

(async () => {
  console.log("LLM Chat Msg Compressor - Quick Benchmark");
  console.log(`Tokenizer: ${tokenizer}`);
  console.log("=".repeat(80));

  for (const [pname, payload] of Object.entries(payloads)) {
    console.log(`\nPayload: ${pname}`);
    for (const cfg of configs) {
      // run a few times and take the median
      const all: any[] = [];
      for (let i = 0; i < runs; i++) all.push(runSingle(payload, cfg));
      // pick the run with median afterTokens
      all.sort((a, b) => a.afterTokens - b.afterTokens);
      const res = all[Math.floor(all.length / 2)];
      printRow(`${cfg.name}`, res);
    }
  }
  console.log("\nDone. Use `npm run bench` to reproduce.");
})();
