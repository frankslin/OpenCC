# opencc-wasm

[![npm version](https://img.shields.io/npm/v/opencc-wasm.svg)](https://www.npmjs.com/package/opencc-wasm)
[![CDN](https://img.shields.io/badge/CDN-jsDelivr-orange.svg)](https://cdn.jsdelivr.net/npm/opencc-wasm@latest/dist/esm/index.js)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[繁體中文](README.zh.md)

> 🚀 **Out-of-the-box Chinese text conversion library** - 3 lines of code, auto-loads configs and dictionaries from CDN!

WebAssembly port of OpenCC (Open Chinese Convert) with full API compatibility. Bundles the official OpenCC C++ core compiled via Emscripten, plus all official configs and prebuilt `.ocd2` dictionaries.

**License:** Apache-2.0

## ✨ Features

- 🎯 **Zero Configuration** - Auto-loads all configs and dictionaries from CDN
- 🔥 **3 Lines to Start** - Simplest API, just import and use
- 🌐 **CDN Ready** - Use directly from jsDelivr/unpkg without bundler
- 📦 **All-in-One** - Includes all 14+ official conversion types
- ⚡ **Auto Caching** - Resources cached after first load
- 🔧 **Full Compatibility** - Compatible with `opencc-js` API
- 🚫 **No Native Bindings** - Pure WASM, cross-platform
- 💻 **Universal** - Works in Node.js, browsers, Deno, etc.

## 🚀 Quick Start

### Browser (CDN - Zero Installation Required!)

```html
<script type="module">
  // 1. Import from CDN
  import OpenCC from "https://cdn.jsdelivr.net/npm/opencc-wasm@0.4.1/dist/esm/index.js";

  // 2. Create converter (auto-downloads everything!)
  const converter = OpenCC.Converter({ config: "s2twp" });

  // 3. Convert - Done!
  const result = await converter("简体中文");
  console.log(result);  // 簡體中文
</script>
```

**That's it!** All configs and dictionaries are automatically downloaded from CDN.

### Node.js (NPM)

```bash
npm install opencc-wasm
```

```javascript
import OpenCC from "opencc-wasm";

const converter = OpenCC.Converter({ config: "s2twp" });
const result = await converter("简体中文");
console.log(result);  // 簡體中文
```

## 📖 API Reference

### OpenCC.Converter() - Create Converter

Two ways to specify conversions:

#### Method 1: Using `config` parameter (Recommended)

Directly specify OpenCC config file name:

```javascript
// Simplified → Traditional (Taiwan phrases)
const converter = OpenCC.Converter({ config: "s2twp" });
const result = await converter("服务器软件");  // 伺服器軟體
```

**Supported configs:**

| Config | Description | Example |
|--------|-------------|---------|
| `s2twp` | Simplified → Taiwan Traditional (with regional phrases) | 软件 → 軟體 |
| `s2tw` | Simplified → Taiwan Traditional | 心里 → 心裡 |
| `s2hk` | Simplified → Hong Kong Traditional | 心里  → 心裏 |
| `s2t` | Simplified → OpenCC Standard Traditional | 简体 → 簡體 |
| `tw2sp` | Taiwan → Simplified (with regional phrases) | 滑鼠 → 鼠标 |
| `tw2s` | Taiwan → Simplified | 軟體 → 软件 |
| `tw2t` | Taiwan → Traditional | 吃飯 → 喫飯 |
| `hk2s` | Hong Kong → Simplified | 打印機 → 打印机 |
| `hk2t` | Hong Kong → Traditional | 為 → 爲 |
| `t2s` | OpenCC Standard Traditional → Simplified | 繁體 → 繁体 |
| `t2tw` | OpenCC Standard Traditional → Taiwan | 牀 → 床 |
| `t2hk` | OpenCC Standard Traditional → Hong Kong | 爲 → 為 |
| `jp2t` | Japanese Shinjitai → Traditional | 桜花 → 櫻花 |
| `t2jp` | Traditional → Japanese Shinjitai | 櫻花 → 桜花 |
| `t2cngov` | Traditional → CN Gov Standard | 潮溼 → 潮湿 |
| `t2cngov_keep_simp` | Traditional → CN Gov (Keep Simp) | 简体繁體 → 简体繁體 |

#### Method 2: Using `from`/`to` parameters (compatible with `opencc-js`)

Specify source and target locales:

```javascript
const converter = OpenCC.Converter({ from: "cn", to: "twp" });
const result = await converter("服务器");  // 伺服器
```

**Locale codes:**

| Code | Description |
|------|-------------|
| `cn` | Simplified Chinese (Mainland) |
| `tw` | Traditional Chinese (Taiwan) |
| `twp` | Taiwan with phrases |
| `hk` | Traditional Chinese (Hong Kong) |
| `t` | Traditional Chinese (general) |
| `s` | Simplified Chinese (alias) |
| `sp` | Simplified with phrases |
| `jp` | Japanese Shinjitai |

**Both methods work identically!** Choose what you prefer.

### OpenCC.ConverterFactory() - With Custom Dictionary

```javascript
const converter = OpenCC.ConverterFactory(
  "cn",        // from
  "tw",        // to
  [            // custom dictionaries
    [["服务器", "伺服器"], ["文件", "檔案"]],
    "網路 网络 | 檔案 文件"
  ]
);

const result = await converter("服务器上的文件通过网络传输");
// Output: 伺服器上的檔案通過網路傳輸
```

### OpenCC.CustomConverter() - Pure Custom Converter

```javascript
const converter = OpenCC.CustomConverter([
  [""", "「"],
  [""", "」"],
  ["'", "『"],
  ["'", "』"],
]);

const result = converter("这是"引号"和'单引号'");
// Output: 这是「引号」和『单引号』
```

## 💡 Usage Examples

### React

```jsx
import { useState } from 'react';
import OpenCC from 'opencc-wasm';

function App() {
  const [output, setOutput] = useState('');

  const handleConvert = async () => {
    const converter = OpenCC.Converter({ config: "s2tw" });
    setOutput(await converter("简体中文"));
  };

  return (
    <div>
      <button onClick={handleConvert}>Convert</button>
      <div>{output}</div>
    </div>
  );
}
```

### Vue 3

```vue
<script setup>
import { ref } from 'vue';
import OpenCC from 'opencc-wasm';

const output = ref('');

async function handleConvert() {
  const converter = OpenCC.Converter({ config: "s2tw" });
  output.value = await converter("简体中文");
}
</script>

<template>
  <button @click="handleConvert">Convert</button>
  <div>{{ output }}</div>
</template>
```

### Node.js CLI

```javascript
#!/usr/bin/env node
import OpenCC from 'opencc-wasm';

const text = process.argv[2] || "简体中文";
const converter = OpenCC.Converter({ config: "s2tw" });
console.log(await converter(text));
```

### Web Worker

```javascript
// worker.js
import OpenCC from 'opencc-wasm';

let converters = {};

self.onmessage = async (e) => {
  const { config, text } = e.data;

  if (!converters[config]) {
    converters[config] = OpenCC.Converter({ config });
  }

  const result = await converters[config](text);
  self.postMessage(result);
};
```

```javascript
// main.js
const worker = new Worker('worker.js', { type: 'module' });

worker.onmessage = (e) => {
  console.log('Result:', e.data);
};

worker.postMessage({ config: 's2tw', text: '简体中文' });
```

## 🔧 Best Practices

### ✅ Reuse Converter Instances

```javascript
// ✅ Good: Create once, use many times
const converter = OpenCC.Converter({ config: "s2tw" });

for (const text of manyTexts) {
  await converter(text);  // Fast!
}
```

```javascript
// ❌ Avoid: Creating new instances every time
for (const text of manyTexts) {
  const converter = OpenCC.Converter({ config: "s2tw" });  // Slow!
  await converter(text);
}
```

### Multiple Converters (Auto-cached)

```javascript
// Create multiple converters (resources auto-cached)
const s2t = OpenCC.Converter({ config: "s2t" });
const s2tw = OpenCC.Converter({ config: "s2tw" });
const t2s = OpenCC.Converter({ config: "t2s" });

// Use independently
console.log(await s2t("简体"));   // 簡體
console.log(await s2tw("软件"));  // 軟體
console.log(await t2s("繁體"));   // 繁体
```

### TypeScript

```typescript
import OpenCC from 'opencc-wasm';

type ConfigName = 's2t' | 's2tw' | 's2twp' | 't2s';

async function convert(config: ConfigName, text: string): Promise<string> {
  const converter = OpenCC.Converter({ config });
  return await converter(text);
}

const result = await convert('s2tw', '简体中文');
```

## 🏗️ Build

The project uses a two-stage build process:

### Stage 1: Build WASM

```bash
./build.sh
```

Compiles OpenCC + marisa-trie to WASM, outputs to `build/`:
- `build/opencc-wasm.esm.js` - ESM WASM glue
- `build/opencc-wasm.cjs` - CJS WASM glue
- `build/opencc-wasm.wasm` - WASM binary

### Stage 2: Build API

```bash
node scripts/build-api.js
```

Generates publishable distribution in `dist/`:
- Copies WASM files to `dist/esm/` and `dist/cjs/`
- Transforms source to production paths
- Copies data files to `dist/data/`

### Complete Build

```bash
npm run build
```

Runs both stages automatically.

## 🧪 Testing

```bash
npm test
```

Runs the upstream OpenCC test cases against the WASM build.

## 📁 Project Structure

```
wasm-lib/
├── build/              ← Intermediate WASM artifacts (gitignored)
├── dist/               ← Publishable distribution (committed)
│   ├── esm/
│   │   ├── index.js
│   │   ├── opencc-wasm.js
│   │   └── opencc-wasm.wasm
│   ├── cjs/
│   │   ├── index.cjs
│   │   ├── opencc-wasm.cjs
│   │   └── opencc-wasm.wasm
│   └── data/           ← OpenCC configs + dicts
├── index.js            ← Source API
├── index.d.ts          ← TypeScript definitions
└── scripts/
    └── build-api.js    ← Build script
```

## ❓ FAQ

**Q: Do configs and dicts auto-load or do I need to download them?**

A: Auto-load! The high-level API (`OpenCC.Converter()`) automatically downloads everything from CDN.

**Q: Does it re-download every time?**

A: No! Resources are cached after first load.

**Q: Works offline?**

A: Yes! If installed via npm, all resources are bundled. For browsers, use Service Worker for offline caching.

**Q: Which method to use: `config` or `from`/`to`?**

A: Both work identically. Use `config` if you know OpenCC config names, or `from`/`to` for locale-based approach.

**Q: Why is the first conversion slow?**

A: Initial load downloads configs + dicts (~1-2MB). Subsequent conversions are fast (cached).

## 📝 Notes

- Uses persistent OpenCC handles to avoid reloading configs
- Dictionaries stored in `/data/dict/` in virtual FS
- Memory grows on demand (`ALLOW_MEMORY_GROWTH=1`)
- Performance: Focuses on fidelity and compatibility with official OpenCC. May be slower than pure-JS implementations for raw throughput, but guarantees full OpenCC behavior.

## 📜 Changelog

### 0.7.0 - 2026-04-13

- Rebased the wasm branch onto upstream `master`
- Switched WASM Jieba support to reuse the upstream plugin implementation
- Registered the Jieba plugin statically inside the WASM module instead of using dynamic loading
- Restored bundled Jieba configs, dictionaries, and comparison tests in `wasm-lib` / `dist`
- Regenerated release artifacts and revalidated the full Node test suite

### 0.6.3 - 2026-03-31

- Upstream alignment and cngov dictionary refresh
- Rebuilt publishable `dist/` artifacts after the dictionary sync

### 0.6.0 - 2026-01-17

- Added Jieba segmentation support (cppjieba) for improved phrase handling
- New conversion configs: `s2twp_jieba`, `tw2sp_jieba`
- Bundled Jieba dictionaries/models in the wasm distribution
- Added Jieba comparison testcases and usage notes

### 0.4.1 - 2026-01-05

- Ensure nested dict directories (e.g., `cngov`) are created before writing to the in-memory FS
- Refresh script correctly handles nested `.ocd2` paths and config JSON copying

### 0.4.0 - 2026-01-04

**Added:**
- `config` parameter in `Converter()` for direct OpenCC config names
- New CN Government Standard conversions: `t2cngov`, `t2cngov_keep_simp`
- New demo page and regression tests for new configs

**Fixed:**
- s2twp duplication bug (issue #950)
- tw2sp `方程式` conversion regression and dictionary sync
- Missing cngov configs/dicts in wasm-lib distribution

### 0.3.0 - 2026-01-03

**🚨 BREAKING: New Distribution Layout**

`.wasm` files moved to be co-located with glue code:
- `dist/esm/opencc-wasm.wasm` (was: `dist/opencc-wasm.esm.wasm`)
- `dist/cjs/opencc-wasm.wasm` (was: `dist/opencc-wasm.cjs.wasm`)

**Added:**
- CDN support for direct browser usage
- Comprehensive test suite
- Auto-loading of configs and dictionaries

### 0.2.1

- Ship both wasm filenames for compatibility

### 0.2.0

- Rebuilt from OpenCC commit [`36c7cbbc`](https://github.com/frankslin/OpenCC/commit/36c7cbbc9702d2a46a89ea7a55ff8ba5656455df)
- New dist layout with ESM/CJS separation
- Tests rewritten using `node:test`

---

**Made with ❤️ for the Chinese NLP community**
