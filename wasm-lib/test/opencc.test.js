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

test("[candidates] enumerates every branch value for a single word", async () => {
  const convert = getConverter("s2t.json");
  const candidates = await convert.candidates("里");

  assert.ok(Array.isArray(candidates));
  // STCharacters.txt maps 里 to all three: 裏 里 哩.
  assert.deepEqual(candidates, ["裏", "里", "哩"]);
});

test("[candidates] returns empty for a word not in any chain dictionary", async () => {
  const convert = getConverter("s2t.json");
  const candidates = await convert.candidates("xyz_not_a_word");

  assert.deepEqual(candidates, []);
});

test("[candidates] no-op locale pair returns the input word unchanged", async () => {
  const convert = OpenCC.Converter({ from: "cn", to: "cn" });
  const candidates = await convert.candidates("里");

  assert.deepEqual(candidates, ["里"]);
});

// Example: an input method typed "li3" and produced the candidate "里" from
// its own dictionary. Before showing it to the user, offer every traditional
// form OpenCC knows about as alternative candidates, exactly like librime's
// ConvertWord does with the native OpenCC library.
test("[candidates] example: expanding an IME candidate into every OpenCC variant", async () => {
  const s2t = OpenCC.Converter({ config: "s2t.json" });
  const imeCandidate = "里";

  const variants = await s2t.candidates(imeCandidate);
  assert.deepEqual(variants, ["裏", "里", "哩"]);

  // A word not covered by any dictionary in the chain is reported as "not
  // found" (empty array), not silently echoed back.
  assert.deepEqual(await s2t.candidates("OpenCC"), []);
});

test("[ambiguities] s2t detects ambiguous spans", async () => {
  const convert = getConverter("s2t.json");
  const result = await convert.convertWithAmbiguities("大战文丑的时候，他的头发很干燥");

  assert.deepEqual(result, [
    { def: "文丑" },
    { lit: "大戰" },
    { amb: { t: "文丑", s: 0 } },
    { lit: "的時候，他的頭髮很乾燥" },
  ]);

  // The output text matches the regular conversion
  const output = result.map(s => s.lit ?? s.amb?.t ?? "").join("");
  assert.equal(output, await convert("大战文丑的时候，他的头发很干燥"));

  // The source can be passed to candidates()
  const defs = result.filter(s => s.def !== undefined).map(s => s.def);
  const amb = result.find(s => s.amb !== undefined);
  assert.deepEqual(await convert.candidates(defs[amb.amb.s]), ["文丑", "文醜"]);
});

test("[ambiguities] unambiguous text returns only literal segments", async () => {
  const convert = getConverter("s2t.json");
  const result = await convert.convertWithAmbiguities("OpenCC");

  assert.deepEqual(result, [
    { lit: "OpenCC" }
  ]);
});

test("[ambiguities] no-op locale pair returns literal text", async () => {
  const convert = OpenCC.Converter({ from: "cn", to: "cn" });
  const result = await convert.convertWithAmbiguities("大战文丑");

  assert.deepEqual(result, [
    { lit: "大战文丑" }
  ]);
});

// Text arguments used to be marshalled through the 64 KiB WASM stack, so any
// input larger than the stack aborted with "memory access out of bounds".
test("[large input] converts text far beyond the WASM stack size", async () => {
  const convert = getConverter("s2twp.json");
  const unit = "鼠标里面的硅二极管坏了。\n";
  const input = unit.repeat(20000); // ~740 KB of UTF-8
  assert.ok(Buffer.byteLength(input, "utf8") > 512 * 1024);

  const output = await convert(input);
  const expectedUnit = await convert(unit);
  assert.strictEqual(output, expectedUnit.repeat(20000));
});

test("[large input] inspect and candidates accept oversized input", async () => {
  const convert = getConverter("s2t.json");
  const input = "开放中文转换。".repeat(20000); // ~420 KB of UTF-8
  assert.ok(Buffer.byteLength(input, "utf8") > 64 * 1024);

  const inspection = await convert.inspect(input);
  assert.strictEqual(inspection.output, await convert(input));
});
