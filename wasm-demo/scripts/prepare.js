#!/usr/bin/env node
/**
 * Copy built assets from node_modules/opencc-wasm into the demo folder
 * so index.html can be served purely statically (no node_modules paths in HTML).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, "..");
const pkgRoot = path.resolve(demoRoot, "node_modules", "opencc-wasm", "dist");

const outDir = path.join(demoRoot, "vendor", "opencc-wasm");

if (!fs.existsSync(pkgRoot)) {
  console.error("opencc-wasm not found. Run `npm install` in wasm-demo first.");
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// copy wasm js/cjs/wasm + data directory
fs.cpSync(pkgRoot, outDir, { recursive: true });

console.log(`Copied dist from ${pkgRoot} to ${outDir}`);
