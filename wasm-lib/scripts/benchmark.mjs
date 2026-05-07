#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const repoRootDir = path.join(rootDir, "..");
const distDir = path.join(rootDir, "dist");
const distEsmDir = path.join(distDir, "esm");
const distDataDir = path.join(distDir, "data");

const DEFAULT_MIN_TIME_MS = 300;
const DEFAULT_WARMUP_TIME_MS = 50;
const LONG_TEXT_PATH = path.join(repoRootDir, "test", "benchmark", "zuozhuan.txt");
const SYNTHETIC_ITERATIONS = [100, 1000, 10000, 100000];
const INITIALIZATION_CONFIGS = [
  "hk2s",
  "hk2t",
  "jp2t",
  "s2hk",
  "s2t",
  "s2tw",
  "s2twp",
  "t2hk",
  "t2jp",
  "t2s",
  "t2tw",
  "tw2s",
  "tw2sp",
  "tw2t",
];
const CONVERSION_CONFIGS = ["s2t", "s2twp"];

const args = parseArgs(process.argv.slice(2));
const minTimeMs = args.minTimeMs;
const warmupTimeMs = args.warmupTimeMs;
const filter = args.filter;

function parseArgs(argv) {
  const parsed = {
    minTimeMs: DEFAULT_MIN_TIME_MS,
    warmupTimeMs: DEFAULT_WARMUP_TIME_MS,
    filter: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--min-time-ms") {
      parsed.minTimeMs = Number(argv[++i]);
      continue;
    }
    if (arg.startsWith("--min-time-ms=")) {
      parsed.minTimeMs = Number(arg.slice("--min-time-ms=".length));
      continue;
    }
    if (arg === "--warmup-time-ms") {
      parsed.warmupTimeMs = Number(argv[++i]);
      continue;
    }
    if (arg.startsWith("--warmup-time-ms=")) {
      parsed.warmupTimeMs = Number(arg.slice("--warmup-time-ms=".length));
      continue;
    }
    if (arg === "--filter") {
      parsed.filter = argv[++i] || "";
      continue;
    }
    if (arg.startsWith("--filter=")) {
      parsed.filter = arg.slice("--filter=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(parsed.minTimeMs) || parsed.minTimeMs <= 0) {
    throw new Error("--min-time-ms must be a positive number");
  }
  if (!Number.isFinite(parsed.warmupTimeMs) || parsed.warmupTimeMs < 0) {
    throw new Error("--warmup-time-ms must be a non-negative number");
  }
  return parsed;
}

function printUsage() {
  console.log(`Usage: npm run benchmark -- [options]

Options:
  --min-time-ms <ms>     Minimum measured time per benchmark (default: ${DEFAULT_MIN_TIME_MS})
  --warmup-time-ms <ms>  Warmup time per benchmark (default: ${DEFAULT_WARMUP_TIME_MS})
  --filter <text>        Only run benchmarks whose name contains text
`);
}

function configPath(configName) {
  return path.join(distDataDir, "config", `${configName}.json`);
}

function hasConfig(configName) {
  return fs.existsSync(configPath(configName));
}

function bytesOf(text) {
  return Buffer.byteLength(text, "utf8");
}

function collectOcd2Files(node, acc) {
  if (!node || typeof node !== "object") return;
  if (node.type === "ocd2" && node.file) acc.add(node.file);
  if (node.type === "group" && Array.isArray(node.dicts)) {
    node.dicts.forEach((child) => collectOcd2Files(child, acc));
  }
}

function collectSegmentationResources(segmentation, acc) {
  if (!segmentation || typeof segmentation !== "object") return;
  const resources = segmentation.resources;
  if (resources && typeof resources === "object") {
    Object.values(resources).forEach((value) => {
      if (typeof value === "string" && value) acc.add(value);
    });
  }
  if (segmentation.type === "jieba") {
    acc.add("jieba_dict/idf.utf8");
    acc.add("jieba_dict/stop_words.utf8");
  }
}

function patchDictPaths(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "ocd2" && node.file) {
    node.file = `/data/dict/${node.file}`;
  }
  if (node.type === "group" && Array.isArray(node.dicts)) {
    node.dicts.forEach(patchDictPaths);
  }
}

function patchSegmentationResources(segmentation) {
  if (!segmentation || typeof segmentation !== "object") return;
  const resources = segmentation.resources;
  if (!resources || typeof resources !== "object") return;
  for (const [key, value] of Object.entries(resources)) {
    if (typeof value === "string" && value) {
      resources[key] = `/data/${value}`;
    }
  }
}

function ensureParentDir(mod, filePath) {
  const idx = filePath.lastIndexOf("/");
  if (idx > 0) {
    mod.FS.mkdirTree(filePath.slice(0, idx));
  }
}

function readConfig(configName) {
  const file = configPath(configName);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing config: ${file}. Run npm run build first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function syntheticText(iteration) {
  let text = "";
  for (let i = 0; i < iteration; i += 1) {
    text += `Open Chinese Convert 開放中文轉換${i}\n`;
  }
  return text;
}

function formatMs(ms) {
  if (ms < 1) return ms.toFixed(3);
  if (ms < 10) return ms.toFixed(2);
  if (ms < 100) return ms.toFixed(1);
  return ms.toFixed(0);
}

function formatThroughput(bytesPerIteration, meanMs) {
  if (!bytesPerIteration || meanMs <= 0) return "";
  const mb = bytesPerIteration / 1000000;
  const seconds = meanMs / 1000;
  return `${(mb / seconds).toFixed(2)} MB/s`;
}

function benchmarkNameMatches(name) {
  return !filter || name.includes(filter);
}

function runAdaptive(fn, options = {}) {
  const minMs = options.minTimeMs ?? minTimeMs;
  const warmupMs = options.warmupTimeMs ?? warmupTimeMs;
  let iterations = 1;
  let total = 0;

  while (total < warmupMs) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) fn();
    total = performance.now() - start;
    if (total < warmupMs) iterations *= 2;
  }

  iterations = 1;
  total = 0;
  while (total < minMs) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) fn();
    total = performance.now() - start;
    if (total < minMs) iterations *= 2;
  }

  return {
    iterations,
    totalMs: total,
    meanMs: total / iterations,
  };
}

function printGroup(title, rows) {
  if (rows.length === 0) return;
  console.log(`\n[${title}]`);
  const nameWidth = Math.max("Benchmark".length, ...rows.map((row) => row.name.length));
  const header =
    `${"Benchmark".padEnd(nameWidth)} ` +
    `${"Time".padStart(12)} ` +
    `${"Iterations".padStart(12)} ` +
    `${"Throughput".padStart(16)}`;
  console.log("-".repeat(header.length));
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)} ` +
        `${`${formatMs(row.meanMs)} ms`.padStart(12)} ` +
        `${String(row.iterations).padStart(12)} ` +
        `${(row.throughput || "").padStart(16)}`
    );
  }
}

async function main() {
  if (!fs.existsSync(LONG_TEXT_PATH)) {
    throw new Error(`Missing benchmark text: ${LONG_TEXT_PATH}`);
  }

  const glueModulePath = path.join(distEsmDir, "opencc-wasm.js");
  if (!fs.existsSync(glueModulePath)) {
    throw new Error(`Missing WASM glue: ${glueModulePath}. Run npm run build first.`);
  }

  const { default: initOpenCC } = await import(pathToFileURL(glueModulePath).href);
  const mod = await initOpenCC({
    locateFile: (file) => pathToFileURL(path.join(distEsmDir, file)).href,
  });
  const api = {
    create: mod.cwrap("opencc_create", "number", ["string"]),
    convert: mod.cwrap("opencc_convert", "number", ["number", "number"]),
    destroy: mod.cwrap("opencc_destroy", null, ["number"]),
  };

  mod.FS.mkdirTree("/data/config");
  mod.FS.mkdirTree("/data/dict");

  const preparedConfigs = new Set();
  const loadedDicts = new Set();
  const loadedResources = new Set();

  function loadFileIntoFs(sourcePath, wasmPath, loadedSet, key) {
    if (loadedSet.has(key)) return;
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing benchmark resource: ${sourcePath}`);
    }
    ensureParentDir(mod, wasmPath);
    mod.FS.writeFile(wasmPath, fs.readFileSync(sourcePath));
    loadedSet.add(key);
  }

  function prepareConfig(configName) {
    if (preparedConfigs.has(configName)) return `/data/config/${configName}.json`;

    const cfg = readConfig(configName);
    const dicts = new Set();
    const resources = new Set();
    collectOcd2Files(cfg.segmentation?.dict, dicts);
    collectSegmentationResources(cfg.segmentation, resources);
    if (Array.isArray(cfg.conversion_chain)) {
      cfg.conversion_chain.forEach((item) => collectOcd2Files(item?.dict, dicts));
    }

    for (const file of dicts) {
      loadFileIntoFs(
        path.join(distDataDir, "dict", file),
        `/data/dict/${file}`,
        loadedDicts,
        file
      );
    }
    for (const file of resources) {
      loadFileIntoFs(path.join(distDataDir, file), `/data/${file}`, loadedResources, file);
    }

    patchDictPaths(cfg.segmentation?.dict);
    patchSegmentationResources(cfg.segmentation);
    if (Array.isArray(cfg.conversion_chain)) {
      cfg.conversion_chain.forEach((item) => patchDictPaths(item?.dict));
    }

    const wasmConfigPath = `/data/config/${configName}.json`;
    mod.FS.writeFile(wasmConfigPath, JSON.stringify(cfg));
    preparedConfigs.add(configName);
    return wasmConfigPath;
  }

  function createConverter(configName) {
    const handle = api.create(prepareConfig(configName));
    if (!handle || handle < 0) {
      throw new Error(`opencc_create failed for ${configName}`);
    }
    return handle;
  }

  function withConverter(configName, fn) {
    const handle = createConverter(configName);
    // Keep conversion handles alive for the benchmark process, matching the
    // package wrapper's cache model. Destroying a handle after large conversions
    // can exercise unrelated WASM teardown behavior and distort conversion runs.
    return fn(handle);
  }

  function convertText(handle, text) {
    const bytes = mod.lengthBytesUTF8(text) + 1;
    const inputPtr = mod._malloc(bytes);
    if (!inputPtr) {
      throw new Error(`malloc failed for ${bytes} bytes`);
    }
    try {
      mod.stringToUTF8(text, inputPtr, bytes);
      const outputPtr = api.convert(handle, inputPtr);
      return mod.UTF8ToString(outputPtr);
    } finally {
      mod._free(inputPtr);
    }
  }

  const initConfigs = [...INITIALIZATION_CONFIGS];
  if (hasConfig("s2twp_jieba")) initConfigs.push("s2twp_jieba");
  const conversionConfigs = [...CONVERSION_CONFIGS];
  if (hasConfig("s2twp_jieba")) conversionConfigs.push("s2twp_jieba");

  const longText = fs.readFileSync(LONG_TEXT_PATH, "utf8");
  const longTextBytes = bytesOf(longText);

  console.log("OpenCC WASM benchmark");
  console.log(`Node: ${process.version}`);
  console.log(`WASM: ${path.relative(rootDir, path.join(distEsmDir, "opencc-wasm.wasm"))}`);
  console.log(`Long text: ${path.relative(repoRootDir, LONG_TEXT_PATH)} (${longTextBytes} bytes)`);
  console.log(`Min time: ${minTimeMs} ms`);

  const initializationRows = [];
  for (const configName of initConfigs) {
    const name = `BM_Initialization/${configName}/ocd2`;
    if (!benchmarkNameMatches(name)) continue;
    const result = runAdaptive(() => {
      const handle = createConverter(configName);
      api.destroy(handle);
    });
    initializationRows.push({ name, ...result });
  }
  printGroup("Initialization", initializationRows);

  const longTextRows = [];
  for (const configName of conversionConfigs) {
    const name = `BM_ConvertLongText/${configName}/ocd2`;
    if (!benchmarkNameMatches(name)) continue;
    const row = withConverter(configName, (handle) => {
      const result = runAdaptive(() => {
        convertText(handle, longText);
      });
      return {
        name,
        ...result,
        throughput: formatThroughput(longTextBytes, result.meanMs),
      };
    });
    longTextRows.push(row);
  }
  printGroup("Convert Long Text", longTextRows);

  const syntheticRows = [];
  for (const configName of conversionConfigs) {
    for (const iteration of SYNTHETIC_ITERATIONS) {
      const name = `BM_Convert/${configName}/ocd2/${iteration}`;
      if (!benchmarkNameMatches(name)) continue;
      const text = syntheticText(iteration);
      const textBytes = bytesOf(text);
      const row = withConverter(configName, (handle) => {
        const result = runAdaptive(() => {
          convertText(handle, text);
        });
        return {
          name,
          ...result,
          throughput: formatThroughput(textBytes, result.meanMs),
        };
      });
      syntheticRows.push(row);
    }
  }
  printGroup("Convert", syntheticRows);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
