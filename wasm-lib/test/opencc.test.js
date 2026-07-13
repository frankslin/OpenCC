import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import OpenCC from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadCases(filename) {
  const filePath = path.join(__dirname, filename);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return parsed?.cases || [];
}

// Each fixture file mirrors a specific native harness. testcases.json and
// cngov_testcases.json are validated against the OpenCC library (which includes
// tofu-risk dictionaries by default), while jieba_comparison_testcases.json
// mirrors the CLI-based jieba integration test (which skips them). Run each file
// in the matching mode so wasm is compared apples-to-apples.
const caseGroups = [
  { file: "testcases.json", includeTofuRiskDictionaries: true },
  { file: "cngov_testcases.json", includeTofuRiskDictionaries: true },
  {
    file: "jieba_comparison_testcases.json",
    includeTofuRiskDictionaries: false,
  },
];

const cases = caseGroups.flatMap((group) =>
  loadCases(group.file).map((tc) => ({
    ...tc,
    includeTofuRiskDictionaries: group.includeTofuRiskDictionaries,
  }))
);

const converterCache = new Map();
function getConverter(config, includeTofuRiskDictionaries) {
  const cacheKey = `${config}::tofu=${includeTofuRiskDictionaries}`;
  if (!converterCache.has(cacheKey)) {
    converterCache.set(
      cacheKey,
      OpenCC.Converter({ config, includeTofuRiskDictionaries })
    );
  }
  return converterCache.get(cacheKey);
}

cases.forEach((tc, idx) => {
  if (!tc.expected || typeof tc.expected !== "object") return;
  Object.entries(tc.expected).forEach(([cfg, expected]) => {
    const configName = `${cfg}.json`;
    test(`[${configName}] case #${idx + 1}${tc.id ? ` (${tc.id})` : ""}`, async () => {
      const convert = getConverter(configName, tc.includeTofuRiskDictionaries);
      const actual = await convert(tc.input);
      assert.strictEqual(actual, expected);
    });
  });
});

test("[tofu] includeTofuRiskDictionaries toggles tofu-risk output", async () => {
  // Default aligns with the official OpenCC library APIs (include tofu-risk dicts).
  const included = OpenCC.Converter({ config: "tw2sp_jieba.json" });
  const includedExplicit = OpenCC.Converter({
    config: "tw2sp_jieba.json",
    includeTofuRiskDictionaries: true,
  });
  const skipped = OpenCC.Converter({
    config: "tw2sp_jieba.json",
    includeTofuRiskDictionaries: false,
  });

  assert.strictEqual(await included("㑮"), "𫝈");
  assert.strictEqual(await includedExplicit("㑮"), "𫝈");
  assert.strictEqual(await skipped("㑮"), "㑮");
});

test("[inspect] output matches normal conversion for s2twp", async () => {
  const convert = getConverter("s2twp.json");
  const inspected = await convert.inspect(
    "他只看了几行日志，就一叶知秋，猜到整个系统是数据库连接池出了问题"
  );

  assert.equal(typeof inspected.input, "string");
  assert.ok(Array.isArray(inspected.segments));
  assert.ok(Array.isArray(inspected.stages));
  assert.equal(
    inspected.output,
    await convert("他只看了几行日志，就一叶知秋，猜到整个系统是数据库连接池出了问题")
  );
});

test("[inspect] jieba config exposes segmentation result", async () => {
  const convert = getConverter("s2twp_jieba.json");
  const inspected = await convert.inspect("勇敢的士兵");

  assert.deepEqual(inspected.segments, ["勇敢", "的", "士兵"]);
  assert.equal(inspected.output, "勇敢的士兵");
});

test("[inspect] config shorthand without .json stays supported", async () => {
  const convert = OpenCC.Converter({ config: "s2twp" });
  const inspected = await convert.inspect("一叶知秋");

  assert.equal(await convert("一叶知秋"), "一葉知秋");
  assert.equal(inspected.output, "一葉知秋");
});
