import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import OpenCC from "../dist/esm/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configDir = path.join(__dirname, "../data/config");

// Get all config files
const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith(".json"));

const converterCache = new Map();
function getConverter(config) {
  if (!converterCache.has(config)) {
    converterCache.set(config, OpenCC.Converter({ config }));
  }
  return converterCache.get(config);
}

// Test each config file's examples
for (const configFile of configFiles) {
  const configPath = path.join(configDir, configFile);
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Skip if no examples
  if (!config.examples || !Array.isArray(config.examples) || config.examples.length === 0) {
    continue;
  }

  // Test each example
  config.examples.forEach((example, idx) => {
    test(`[${configFile}] ${config.description_zh || config.name} - example #${idx + 1}: "${example.input}"`, async () => {
      const convert = getConverter(configFile);
      const actual = await convert(example.input);
      assert.strictEqual(
        actual,
        example.output,
        `Expected "${example.input}" to convert to "${example.output}", but got "${actual}"`
      );
    });
  });
}
