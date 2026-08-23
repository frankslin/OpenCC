#!/usr/bin/env node

// Cross-implementation benchmark: compares the three npm packages that expose
// OpenCC to JavaScript on identical workloads.
//
//   opencc       native N-API addon (libopencc)
//   opencc-wasm  this repository's WebAssembly build
//   opencc-js    pure JavaScript implementation (nk2028)
//
// Each library is measured in its own child process so cold-start cost and
// resident memory are not polluted by the other implementations.
//
// Usage:
//   node scripts/benchmark-compare.mjs [--resolve-from <dir>] [options]
//
// The packages are resolved from <dir>/node_modules (default: this package's
// directory, then the repository root). Missing packages are skipped with a
// note instead of failing the whole run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import os from "node:os";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const repoRootDir = path.join(rootDir, "..");
const LONG_TEXT_PATH = path.join(repoRootDir, "test", "benchmark", "zuozhuan.txt");

const DEFAULT_MIN_TIME_MS = 500;
const DEFAULT_WARMUP_TIME_MS = 100;
const SHORT_TEXT =
  "鼠标里面的硅二极管坏了，网络连接不上，只好用软件重新配置服务器的打印机驱动程序。";

// Library id -> package name / local path plus the locale pair for each config.
const LIBRARIES = {
  opencc: { label: "opencc (native)", pkg: "opencc", kind: "native" },
  "opencc-wasm": { label: "opencc-wasm", pkg: "opencc-wasm", kind: "wasm" },
  "opencc-wasm-local": {
    label: "opencc-wasm (local build)",
    dir: rootDir,
    kind: "wasm",
  },
  "opencc-js": { label: "opencc-js", pkg: "opencc-js", kind: "js" },
};

const DEFAULT_LIBRARIES = ["opencc", "opencc-wasm", "opencc-js"];

// Locale pairs shared by the opencc-js compatible APIs (opencc-js, opencc-wasm).
const CONFIGS = {
  s2t: { config: "s2t.json", from: "cn", to: "t" },
  s2twp: { config: "s2twp.json", from: "cn", to: "twp" },
  t2s: { config: "t2s.json", from: "t", to: "cn" },
};

const DEFAULT_CONFIGS = ["s2t", "s2twp"];

function parseArgs(argv) {
  const parsed = {
    minTimeMs: DEFAULT_MIN_TIME_MS,
    warmupTimeMs: DEFAULT_WARMUP_TIME_MS,
    resolveFrom: "",
    libraries: [...DEFAULT_LIBRARIES],
    configs: [...DEFAULT_CONFIGS],
    json: "",
    includeTofu: false,
  };

  const takeValue = (arg, i) => {
    const eq = arg.indexOf("=");
    if (eq >= 0) return [arg.slice(eq + 1), i];
    return [argv[i + 1], i + 1];
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("--min-time-ms")) {
      const [value, next] = takeValue(arg, i);
      parsed.minTimeMs = Number(value);
      i = next;
    } else if (arg.startsWith("--warmup-time-ms")) {
      const [value, next] = takeValue(arg, i);
      parsed.warmupTimeMs = Number(value);
      i = next;
    } else if (arg.startsWith("--resolve-from")) {
      const [value, next] = takeValue(arg, i);
      parsed.resolveFrom = value || "";
      i = next;
    } else if (arg.startsWith("--libs")) {
      const [value, next] = takeValue(arg, i);
      parsed.libraries = String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i = next;
    } else if (arg.startsWith("--configs")) {
      const [value, next] = takeValue(arg, i);
      parsed.configs = String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i = next;
    } else if (arg === "--include-tofu") {
      parsed.includeTofu = true;
    } else if (arg.startsWith("--json")) {
      const [value, next] = takeValue(arg, i);
      parsed.json = value || "";
      i = next;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(parsed.minTimeMs) || parsed.minTimeMs <= 0) {
    throw new Error("--min-time-ms must be a positive number");
  }
  if (!Number.isFinite(parsed.warmupTimeMs) || parsed.warmupTimeMs < 0) {
    throw new Error("--warmup-time-ms must be a non-negative number");
  }
  for (const lib of parsed.libraries) {
    if (!LIBRARIES[lib]) throw new Error(`Unknown library: ${lib}`);
  }
  for (const config of parsed.configs) {
    if (!CONFIGS[config]) throw new Error(`Unknown config: ${config}`);
  }
  return parsed;
}

function printUsage() {
  console.log(`Usage: node scripts/benchmark-compare.mjs [options]

Options:
  --resolve-from <dir>   Directory whose node_modules holds opencc / opencc-js /
                         opencc-wasm (default: wasm-lib, then repository root)
  --libs <a,b,c>         Libraries to measure (default: ${DEFAULT_LIBRARIES.join(",")})
                         Available: ${Object.keys(LIBRARIES).join(", ")}
  --configs <a,b>        Conversions to measure (default: ${DEFAULT_CONFIGS.join(",")})
                         Available: ${Object.keys(CONFIGS).join(", ")}
  --min-time-ms <ms>     Minimum measured time per benchmark (default: ${DEFAULT_MIN_TIME_MS})
  --warmup-time-ms <ms>  Warmup time per benchmark (default: ${DEFAULT_WARMUP_TIME_MS})
  --include-tofu         Keep dictionaries marked may_output_tofu in opencc and
                         opencc-wasm. Off by default so all three libraries run
                         the same dictionary set: opencc-js has no such option
                         and always behaves as if they were excluded.
  --json <file>          Also write the raw results as JSON
`);
}

// ---------------------------------------------------------------------------
// Package resolution
// ---------------------------------------------------------------------------

function candidateModuleDirs(resolveFrom) {
  const dirs = [];
  if (resolveFrom) dirs.push(path.resolve(resolveFrom));
  dirs.push(rootDir, repoRootDir, process.cwd());
  return dirs;
}

function findPackageDir(pkg, resolveFrom) {
  for (const dir of candidateModuleDirs(resolveFrom)) {
    const candidate = path.join(dir, "node_modules", pkg);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return null;
}

function entryPointOf(pkgDir, preferEsm) {
  const meta = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const root = meta.exports?.["."];
  let entry = null;
  if (typeof root === "string") {
    entry = root;
  } else if (root && typeof root === "object") {
    entry = preferEsm ? root.import || root.require : root.require || root.import;
    if (entry && typeof entry === "object") entry = entry.default;
  }
  if (!entry && preferEsm) entry = meta.module;
  if (!entry) entry = meta.main || "index.js";
  return { path: path.join(pkgDir, entry), version: meta.version };
}

function resolveLibrary(libId, resolveFrom) {
  const spec = LIBRARIES[libId];
  const pkgDir = spec.dir ? spec.dir : findPackageDir(spec.pkg, resolveFrom);
  if (!pkgDir) return null;
  const preferEsm = spec.kind !== "native";
  const { path: entry, version } = entryPointOf(pkgDir, preferEsm);
  if (!fs.existsSync(entry)) return null;
  return { ...spec, id: libId, dir: pkgDir, entry, version };
}

// ---------------------------------------------------------------------------
// Adapters: every adapter exposes async create(configKey) -> async convert(text)
// ---------------------------------------------------------------------------

async function loadAdapter(resolved, includeTofu) {
  const url = pathToFileURL(resolved.entry).href;
  const mod = await import(url);
  const api = mod.default ?? mod;

  if (resolved.kind === "native") {
    const OpenCC = api.OpenCC ?? mod.OpenCC;
    return (configKey) => {
      const converter = new OpenCC(CONFIGS[configKey].config, {
        includeTofuRiskDictionaries: includeTofu,
      });
      return async (text) => converter.convertSync(text);
    };
  }

  const Converter = api.Converter ?? mod.Converter;
  if (resolved.kind === "wasm") {
    return (configKey) => {
      const convert = Converter({
        config: CONFIGS[configKey].config,
        includeTofuRiskDictionaries: includeTofu,
      });
      return async (text) => convert(text);
    };
  }

  // opencc-js exposes no tofu-risk switch: its built-in converters always run
  // the chain without the may_output_tofu dictionaries.
  return (configKey) => {
    const { from, to } = CONFIGS[configKey];
    const convert = Converter({ from, to });
    return async (text) => convert(text);
  };
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

async function runAdaptive(fn, minTimeMs, warmupTimeMs) {
  let iterations = 1;
  let total = 0;

  while (total < warmupTimeMs) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) await fn();
    total = performance.now() - start;
    if (total < warmupTimeMs) iterations *= 2;
  }

  iterations = 1;
  total = 0;
  while (total < minTimeMs) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) await fn();
    total = performance.now() - start;
    if (total < minTimeMs) iterations *= 2;
  }

  return { iterations, totalMs: total, meanMs: total / iterations };
}

// ---------------------------------------------------------------------------
// Worker: measures one library in a dedicated process
// ---------------------------------------------------------------------------

async function runWorker(payload) {
  const { libId, resolveFrom, configs, minTimeMs, warmupTimeMs, includeTofu } = payload;
  const resolved = resolveLibrary(libId, resolveFrom);
  if (!resolved) return { libId, available: false };

  const longText = fs.readFileSync(LONG_TEXT_PATH, "utf8");
  const longTextBytes = Buffer.byteLength(longText, "utf8");
  const shortTextBytes = Buffer.byteLength(SHORT_TEXT, "utf8");

  const beforeLoadMs = performance.now();
  const createConverter = await loadAdapter(resolved, includeTofu);
  const loadMs = performance.now() - beforeLoadMs;

  const results = {
    libId,
    available: true,
    label: resolved.label,
    version: resolved.version,
    entry: path.relative(repoRootDir, resolved.entry),
    loadMs,
    configs: {},
  };

  let first = true;
  for (const configKey of configs) {
    // Cold start: only the first config in this process is a true cold start
    // (module load + dictionary load + first conversion); later configs reuse
    // the already-initialized runtime, which is reported as `warmStartMs`.
    const startedAt = performance.now();
    let convert;
    try {
      convert = createConverter(configKey);
      await convert("测试");
    } catch (error) {
      results.configs[configKey] = { error: String(error?.message || error) };
      continue;
    }
    const startupMs = performance.now() - startedAt + (first ? loadMs : 0);

    const longOutput = await convert(longText);
    const long = await runAdaptive(() => convert(longText), minTimeMs, warmupTimeMs);
    const short = await runAdaptive(() => convert(SHORT_TEXT), minTimeMs, warmupTimeMs);

    results.configs[configKey] = {
      cold: first,
      startupMs,
      longMeanMs: long.meanMs,
      longIterations: long.iterations,
      longThroughputMBs: longTextBytes / 1e6 / (long.meanMs / 1000),
      shortMeanUs: short.meanMs * 1000,
      shortIterations: short.iterations,
      shortThroughputMBs: shortTextBytes / 1e6 / (short.meanMs / 1000),
      sample: await convert(SHORT_TEXT),
      longOutputBytes: Buffer.byteLength(longOutput, "utf8"),
      longOutputHash: crypto.createHash("sha256").update(longOutput).digest("hex").slice(0, 12),
    };
    first = false;
  }

  results.rssMB = process.memoryUsage().rss / 1024 / 1024;
  results.longTextBytes = longTextBytes;
  results.shortTextBytes = shortTextBytes;
  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return value.toFixed(0);
  if (value >= 100) return value.toFixed(1);
  return value.toFixed(digits);
}

function printTable(title, headers, rows) {
  if (rows.length === 0) return;
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length))
  );
  const line = (cells) =>
    cells
      .map((cell, index) => (index === 0 ? String(cell).padEnd(widths[index]) : String(cell).padStart(widths[index])))
      .join("  ");
  console.log(`\n[${title}]`);
  console.log("-".repeat(widths.reduce((sum, w) => sum + w + 2, -2)));
  console.log(line(headers));
  console.log("-".repeat(widths.reduce((sum, w) => sum + w + 2, -2)));
  for (const row of rows) console.log(line(row));
}

function report(args, results) {
  const available = results.filter((item) => item.available);
  const fastestOf = (configKey, key) =>
    Math.min(
      ...available
        .map((item) => item.configs[configKey]?.[key])
        .filter((value) => Number.isFinite(value))
    );

  console.log("OpenCC JavaScript implementation comparison");
  console.log(`Node: ${process.version}  Platform: ${process.platform}-${process.arch}`);
  console.log(
    `Long text: ${path.relative(repoRootDir, LONG_TEXT_PATH)} (${available[0]?.longTextBytes ?? 0} bytes)`
  );
  console.log(`Short text: ${available[0]?.shortTextBytes ?? 0} bytes`);
  console.log(`Min time: ${args.minTimeMs} ms`);
  console.log(
    `Tofu-risk dictionaries: ${args.includeTofu ? "included" : "excluded"}` +
      " (opencc-js always excludes them)"
  );

  printTable(
    "Libraries",
    ["Library", "Version", "Entry"],
    available.map((item) => [item.label, item.version, item.entry])
  );

  for (const configKey of args.configs) {
    const rows = [];
    for (const item of available) {
      const data = item.configs[configKey];
      if (!data || data.error) {
        rows.push([item.label, data?.error ? `error: ${data.error}` : "n/a", "", "", "", "", ""]);
        continue;
      }
      rows.push([
        item.label,
        `${fmt(data.startupMs)} ms`,
        `${fmt(data.longMeanMs)} ms`,
        `${fmt(data.longThroughputMBs)} MB/s`,
        `${fmt(data.longMeanMs / fastestOf(configKey, "longMeanMs"), 2)}x`,
        `${fmt(data.shortMeanUs)} us`,
        `${fmt(data.shortMeanUs / fastestOf(configKey, "shortMeanUs"), 2)}x`,
      ]);
    }
    printTable(
      `Conversion: ${configKey}`,
      ["Library", "Startup", "Long text", "Throughput", "Rel.", "Short text", "Rel."],
      rows
    );
  }

  const agreementRows = [];
  for (const configKey of args.configs) {
    for (const item of available) {
      const data = item.configs[configKey];
      if (!data || data.error) continue;
      agreementRows.push([
        `${configKey} / ${item.label}`,
        `${data.longOutputBytes} bytes`,
        data.longOutputHash,
      ]);
    }
  }
  printTable("Long text output (sha256 prefix)", ["Conversion / Library", "Output size", "Hash"], agreementRows);

  printTable(
    "Process RSS after run",
    ["Library", "RSS"],
    available.map((item) => [item.label, `${fmt(item.rssMB)} MB`])
  );

  const missing = results.filter((item) => !item.available);
  if (missing.length > 0) {
    console.log(
      `\nSkipped (not installed): ${missing.map((item) => LIBRARIES[item.libId].label).join(", ")}`
    );
  }

  const outputs = new Map();
  for (const item of available) {
    for (const configKey of args.configs) {
      const sample = item.configs[configKey]?.sample;
      if (!sample) continue;
      const key = `${configKey} ${sample}`;
      if (!outputs.has(key)) outputs.set(key, { configKey, sample, libs: [] });
      outputs.get(key).libs.push(item.label);
    }
  }
  const divergent = args.configs.filter(
    (configKey) => [...outputs.values()].filter((entry) => entry.configKey === configKey).length > 1
  );
  if (divergent.length > 0) {
    console.log("\n[Output differences on the short sample]");
    for (const entry of outputs.values()) {
      if (!divergent.includes(entry.configKey)) continue;
      console.log(`${entry.configKey} ${entry.libs.join(", ")}: ${entry.sample}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const workerEnv = process.env.OPENCC_BENCHMARK_WORKER;
if (workerEnv) {
  const payload = JSON.parse(workerEnv);
  const result = await runWorker(payload);
  process.stdout.write(`${JSON.stringify(result)}`);
} else {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(LONG_TEXT_PATH)) {
    throw new Error(`Missing benchmark text: ${LONG_TEXT_PATH}`);
  }

  const results = [];
  for (const libId of args.libraries) {
    const payload = {
      libId,
      resolveFrom: args.resolveFrom,
      configs: args.configs,
      minTimeMs: args.minTimeMs,
      warmupTimeMs: args.warmupTimeMs,
      includeTofu: args.includeTofu,
    };
    const child = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, OPENCC_BENCHMARK_WORKER: JSON.stringify(payload) },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (child.status !== 0) {
      console.error(child.stderr || `Worker for ${libId} exited with ${child.status}`);
      results.push({ libId, available: false });
      continue;
    }
    const match = /([\s\S]*)/.exec(child.stdout || "");
    if (!match) {
      console.error(`Worker for ${libId} produced no result:\n${child.stdout}`);
      results.push({ libId, available: false });
      continue;
    }
    results.push(JSON.parse(match[1]));
  }

  report(args, results);

  if (args.json) {
    fs.writeFileSync(args.json, `${JSON.stringify({ args, results }, null, 2)}\n`);
    console.log(`\nWrote ${args.json}`);
  }
}
