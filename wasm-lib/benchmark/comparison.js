/**
 * OpenCC Performance Comparison Benchmark
 *
 * Compares performance between:
 * - opencc-js (pure JavaScript implementation)
 * - opencc-wasm (WebAssembly with official OpenCC core)
 */

import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenCCWasm from "../dist/esm/index.js";
import { Converter as OpenCCJSConverter } from "opencc-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Benchmark utilities
class BenchmarkStats {
  constructor() {
    this.times = [];
  }

  add(time) {
    this.times.push(time);
  }

  get iterations() {
    return this.times.length;
  }

  get mean() {
    return this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  get min() {
    return Math.min(...this.times);
  }

  get max() {
    return Math.max(...this.times);
  }

  get stddev() {
    const mean = this.mean;
    const variance = this.times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / this.times.length;
    return Math.sqrt(variance);
  }
}

// Format time
function formatTime(ms) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} µs`;
  }
  return `${ms.toFixed(3)} ms`;
}

// Generate test text
function generateTestText(iterations) {
  let text = "";
  for (let i = 0; i < iterations; i++) {
    text += `Open Chinese Convert 開放中文轉換${i}\n`;
  }
  return text;
}

// Read benchmark text data
function readBenchmarkText(filename) {
  const dataPath = path.join(__dirname, "../../test/benchmark", filename);
  return fs.readFileSync(dataPath, "utf-8");
}

// Benchmark initialization performance
async function benchmarkInitialization(createConverter, minIterations = 10, maxTime = 2000) {
  const stats = new BenchmarkStats();
  const startTime = performance.now();

  while (stats.iterations < minIterations || (performance.now() - startTime) < maxTime) {
    const start = performance.now();
    await createConverter();
    const end = performance.now();
    stats.add(end - start);

    if (stats.iterations >= minIterations && (performance.now() - startTime) >= 1000) {
      break;
    }
  }

  return stats;
}

// Benchmark conversion performance
async function benchmarkConversion(converter, text, minIterations = 10, maxTime = 2000) {
  const stats = new BenchmarkStats();

  // Warm-up
  await converter(text);

  const startTime = performance.now();

  while (stats.iterations < minIterations || (performance.now() - startTime) < maxTime) {
    const start = performance.now();
    await converter(text);
    const end = performance.now();
    stats.add(end - start);

    if (stats.iterations >= minIterations && (performance.now() - startTime) >= 1000) {
      break;
    }
  }

  return stats;
}

// Print comparison results
function printComparison(name, jsStats, wasmStats) {
  const pad = 25;
  const nameStr = name.padEnd(pad);

  const jsTime = formatTime(jsStats.mean).padStart(12);
  const wasmTime = formatTime(wasmStats.mean).padStart(12);

  const speedup = jsStats.mean / wasmStats.mean;
  const speedupStr = speedup > 1
    ? `WASM ${speedup.toFixed(2)}x faster`
    : `JS ${(1/speedup).toFixed(2)}x faster`;

  console.log(`${nameStr}${jsTime}${wasmTime}   ${speedupStr}`);
}

// Main comparison benchmark
async function runComparison() {
  console.log("OpenCC Performance Comparison: opencc-js vs opencc-wasm");
  console.log("=".repeat(80));
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log("=".repeat(80));
  console.log();

  // Test configurations
  const configs = [
    { name: "s2t", jsFrom: "cn", jsTo: "t", wasmConf: "s2t.json" },
    { name: "t2s", jsFrom: "t", jsTo: "cn", wasmConf: "t2s.json" },
    { name: "s2tw", jsFrom: "cn", jsTo: "tw", wasmConf: "s2tw.json" },
    { name: "tw2s", jsFrom: "tw", jsTo: "cn", wasmConf: "tw2s.json" },
  ];

  // Initialization benchmarks
  console.log("1. Initialization Performance");
  console.log("-".repeat(80));
  console.log("Config".padEnd(25) + "opencc-js".padStart(12) + "opencc-wasm".padStart(12) + "   Comparison");
  console.log("-".repeat(80));

  for (const config of configs) {
    const jsStats = await benchmarkInitialization(() => {
      const converter = OpenCCJSConverter({ from: config.jsFrom, to: config.jsTo });
      return Promise.resolve(converter);
    });

    const wasmStats = await benchmarkInitialization(async () => {
      const converter = OpenCCWasm.Converter({ config: config.wasmConf });
      await converter("test"); // Force initialization
      return converter;
    });

    printComparison(config.name, jsStats, wasmStats);
  }

  console.log();

  // Conversion benchmarks with different text sizes
  console.log("2. Conversion Performance");
  console.log("-".repeat(80));

  const testSizes = [
    { name: "Small (100 chars)", iterations: 100 },
    { name: "Medium (1000 chars)", iterations: 1000 },
  ];

  for (const size of testSizes) {
    console.log(`\n${size.name}:`);
    console.log("Config".padEnd(25) + "opencc-js".padStart(12) + "opencc-wasm".padStart(12) + "   Comparison");
    console.log("-".repeat(80));

    const text = generateTestText(size.iterations);

    for (const config of configs) {
      try {
        // opencc-js
        const jsConverter = OpenCCJSConverter({ from: config.jsFrom, to: config.jsTo });
        const jsStats = await benchmarkConversion(
          (t) => Promise.resolve(jsConverter(t)),
          text
        );

        // opencc-wasm
        const wasmConverter = OpenCCWasm.Converter({ config: config.wasmConf });
        const wasmStats = await benchmarkConversion(wasmConverter, text);

        printComparison(config.name, jsStats, wasmStats);
      } catch (err) {
        console.log(`${config.name.padEnd(25)}     SKIPPED (${err.message})`);
      }
    }
  }

  console.log();
  console.log("-".repeat(80));

  // Summary
  console.log("\nSummary:");
  console.log("- opencc-js: Pure JavaScript implementation, fast for small texts");
  console.log("- opencc-wasm: WebAssembly with official OpenCC core, better accuracy");
  console.log("- Both provide similar APIs for easy migration");
  console.log();
}

// Run the comparison
runComparison().catch((err) => {
  console.error("Comparison failed:", err);
  process.exit(1);
});
