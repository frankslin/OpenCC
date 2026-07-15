// Smoke test for the CommonJS entry point (dist/cjs/index.cjs). Guards against
// regressions like using `import.meta` in a CJS module, which makes
// `require("opencc-wasm")` throw at parse time. Requires `npm run build` first.
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const distEntry = path.join(__dirname, "..", "dist", "cjs", "index.cjs");

test("[cjs] require(dist/cjs/index.cjs) loads and converts", async () => {
  const OpenCC = require(distEntry);
  assert.equal(typeof OpenCC.Converter, "function");

  const convert = OpenCC.Converter({ config: "s2twp.json" });
  assert.strictEqual(await convert("简体中文测试"), "簡體中文測試");
});

test("[cjs] candidates(word) enumerates every branch value over CJS", async () => {
  const OpenCC = require(distEntry);
  const convert = OpenCC.Converter({ config: "s2t.json" });
  // STCharacters.txt maps 里 to all three: 裏 里 哩.
  assert.deepEqual(await convert.candidates("里"), ["裏", "里", "哩"]);
});

test("[cjs] includeTofuRiskDictionaries option works over CJS", async () => {
  const OpenCC = require(distEntry);
  const skip = OpenCC.Converter({
    config: "tw2sp_jieba.json",
    includeTofuRiskDictionaries: false,
  });
  const include = OpenCC.Converter({
    config: "tw2sp_jieba.json",
    includeTofuRiskDictionaries: true,
  });
  assert.strictEqual(await skip("㑮"), "㑮");
  assert.strictEqual(await include("㑮"), "𫝈");
});
