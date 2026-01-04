/**
 * OpenCC WASM Performance Benchmark
 *
 * Measures initialization and conversion performance for different configurations
 * Similar to src/benchmark/Performance.cpp for C++ version
 */

import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenCC from "../dist/esm/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Benchmark configurations
const INIT_CONFIGS = [
  "hk2s.json",
  "hk2t.json",
  "jp2t.json",
  "s2hk.json",
  "s2t.json",
  "s2tw.json",
  "s2twp.json",
  "t2hk.json",
  "t2jp.json",
  "t2s.json",
  "tw2s.json",
  "tw2sp.json",
  "tw2t.json",
];

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

// Format time in milliseconds
function formatTime(ms) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} µs`;
  }
  return `${ms.toFixed(3)} ms`;
}

// Read benchmark text data
function readBenchmarkText(filename) {
  const dataPath = path.join(__dirname, "../../test/benchmark", filename);
  return fs.readFileSync(dataPath, "utf-8");
}

// Generate test text with repeated pattern
function generateTestText(iterations) {
  let text = "";
  for (let i = 0; i < iterations; i++) {
    text += `Open Chinese Convert 開放中文轉換${i}\n`;
  }
  return text;
}

// Benchmark initialization performance
async function benchmarkInitialization(configName, minIterations = 10, maxTime = 5000) {
  const stats = new BenchmarkStats();
  const startTime = performance.now();

  // Clear any cached converter
  const handle = new Map();

  while (stats.iterations < minIterations || (performance.now() - startTime) < maxTime) {
    const start = performance.now();

    // Create a new converter (simulating initialization)
    const converter = OpenCC.Converter({ config: configName });

    // Force initialization by doing a dummy conversion
    await converter("test");

    const end = performance.now();
    stats.add(end - start);

    // Early exit if we have enough samples and took enough time
    if (stats.iterations >= minIterations && (performance.now() - startTime) >= 1000) {
      break;
    }
  }

  return stats;
}

// Benchmark conversion performance
async function benchmarkConversion(text, minIterations = 10, maxTime = 5000) {
  const stats = new BenchmarkStats();
  const converter = OpenCC.Converter({ config: "s2t.json" });

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

// Print benchmark results
function printResults(name, stats) {
  const pad = 40;
  const nameStr = name.padEnd(pad);
  const timeStr = formatTime(stats.mean).padStart(12);
  const iterStr = stats.iterations.toString().padStart(8);
  console.log(`${nameStr}${timeStr}   ${iterStr} iterations`);
}

// Main benchmark runner
async function runBenchmarks() {
  console.log("OpenCC WASM Performance Benchmark");
  console.log("=".repeat(70));
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log("=".repeat(70));
  console.log();

  // Initialization benchmarks
  console.log("Initialization Performance");
  console.log("-".repeat(70));
  console.log("Benchmark".padEnd(40) + "Time".padStart(12) + "   " + "Iterations".padStart(8));
  console.log("-".repeat(70));

  for (const config of INIT_CONFIGS) {
    const stats = await benchmarkInitialization(config);
    const name = `BM_Initialization/${config.replace(".json", "")}`;
    printResults(name, stats);
  }

  console.log();

  // Conversion benchmarks with different text sizes
  console.log("Conversion Performance (s2t)");
  console.log("-".repeat(70));
  console.log("Benchmark".padEnd(40) + "Time".padStart(12) + "   " + "Iterations".padStart(8));
  console.log("-".repeat(70));

  const sizes = [
    { name: "100", iterations: 100 },
    { name: "1000", iterations: 1000 },
    { name: "10000", iterations: 10000 },
  ];

  for (const size of sizes) {
    try {
      const text = generateTestText(size.iterations);
      const stats = await benchmarkConversion(text);
      const name = `BM_Convert/${size.name}`;
      printResults(name, stats);
    } catch (err) {
      const name = `BM_Convert/${size.name}`;
      console.log(`${name.padEnd(40)}     SKIPPED (${err.message})`);
    }
  }

  // Benchmark with real 2M text (zuozhuan.txt)
  try {
    const zuozhuan = readBenchmarkText("zuozhuan.txt");
    const stats = await benchmarkConversion(zuozhuan);
    printResults("BM_Convert2M", stats);
  } catch (err) {
    console.log(`BM_Convert2M                                      SKIPPED (${err.message})`);
  }

  console.log("-".repeat(70));
  console.log();
  console.log("Benchmark complete!");
}

// Run the benchmarks
runBenchmarks().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
