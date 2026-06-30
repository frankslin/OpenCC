# opencc-wasm

[![npm version](https://img.shields.io/npm/v/opencc-wasm.svg)](https://www.npmjs.com/package/opencc-wasm)
[![CDN](https://img.shields.io/badge/CDN-jsDelivr-orange.svg)](https://cdn.jsdelivr.net/npm/opencc-wasm@latest/dist/esm/index.js)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[English](README.md)

> 🚀 **開箱即用的中文簡繁轉換程式庫** - 3 行程式碼搞定，自動從 CDN 載入設定和字典！

OpenCC（Open Chinese Convert）的 WebAssembly 移植版本，完全相容原版 API。內建官方 OpenCC C++ 核心（透過 Emscripten 編譯）、官方設定檔、隨附的大陸政府標準設定、Jieba 設定，以及預先建置的 `.ocd2` 字典檔。

**授權條款：** Apache-2.0

## ✨ 特色功能

- 🎯 **零設定** - 自動從 CDN 載入所有設定檔和字典檔
- 🔥 **3 行開始** - 最簡單的 API，匯入即用
- 🌐 **CDN 就緒** - 可直接從 jsDelivr/unpkg 使用，無需打包工具
- 📦 **一應俱全** - 包含官方轉換類型、Jieba 變體與隨附的大陸政府標準轉換
- ⚡ **自動快取** - 資源首次載入後自動快取
- 🔧 **完全相容** - 相容 `opencc-js` API
- 🚫 **無需原生綁定** - 純 WASM，跨平台
- 💻 **通用支援** - 支援 Node.js、瀏覽器、Deno 等環境

## 🚀 快速開始

### 瀏覽器（CDN - 零安裝！）

```html
<script type="module">
  // 1. 從 CDN 匯入
  import OpenCC from "https://cdn.jsdelivr.net/npm/opencc-wasm@0.10.0/dist/esm/index.js";

  // 2. 建立轉換器（自動下載所有資源！）
  const converter = OpenCC.Converter({ config: "s2twp" });

  // 3. 轉換 - 完成！
  const result = await converter("简体中文");
  console.log(result);  // 簡體中文
</script>
```

**就是這麼簡單！** 所有設定檔和字典檔都會自動從 CDN 下載。

### Node.js（NPM）

```bash
npm install opencc-wasm
```

```javascript
import OpenCC from "opencc-wasm";

const converter = OpenCC.Converter({ config:"s2twp" });
const result = await converter("简体中文");
console.log(result);  // 簡體中文
```

## 📖 API 參考

### OpenCC.Converter() - 建立轉換器

兩種方式指定轉換：

#### 方式 1：使用 `config` 參數（推薦）

直接指定 OpenCC 設定檔名稱：

```javascript
// 簡體 → 繁體（台灣慣用詞）
const converter = OpenCC.Converter({ config: "s2twp" });
const result = await converter("服务器软件");  // 伺服器軟體
```

`Converter()` 也提供 inspect 輔助方法：

```javascript
const converter = OpenCC.Converter({ config: "s2twp" });
const inspected = await converter.inspect("勇敢的士兵");
console.log(inspected.segments); // 分詞結果
console.log(inspected.stages);   // 每一階段的轉換結果
console.log(inspected.output);   // 最終輸出
```

同樣的 API 也可直接用在大陸政府標準繁體的 Jieba 設定：

```javascript
const converter = OpenCC.Converter({ config: "t2cngov_jieba" });
console.log(await converter("測試简体混繁體")); // 測試簡體混繁體

const keepSimp = OpenCC.Converter({ config: "t2cngov_keep_simp_jieba" });
console.log(await keepSimp("測試简体混繁體")); // 測試简体混繁體
```

**支援的設定檔：**

| 設定檔 | 說明 | 範例 |
|--------|------|------|
| `s2twp` | 簡體 → 台灣正體（含地域用詞轉換） | 软件 → 軟體 |
| `s2twp_jieba` | 簡體 → 台灣正體（含地域用詞，Jieba 分詞） | 服务器软件 → 伺服器軟體 |
| `s2tw` | 簡體 → 台灣正體 | 心里 → 心裡 |
| `s2tw_jieba` | 簡體 → 台灣正體（Jieba 分詞） | 心里 → 心裡 |
| `s2hk` | 簡體 → 香港繁體 | 心里  → 心裏 |
| `s2hk_jieba` | 簡體 → 香港繁體（Jieba 分詞） | 心里 → 心裏 |
| `s2t` | 簡體 → OpenCC 標準繁體 | 简体 → 簡體 |
| `s2t_jieba` | 簡體 → OpenCC 標準繁體（Jieba 分詞） | 简体 → 簡體 |
| `s2t_cngov` | 簡體 → 大陸政府標準繁體 | 简体 → 簡體 |
| `tw2sp` | 台灣正體 → 簡體（含地域用詞轉換） | 滑鼠 → 鼠标 |
| `tw2sp_jieba` | 台灣正體 → 簡體（含地域用詞，Jieba 分詞） | 伺服器軟體 → 服务器软件 |
| `tw2s` | 台灣正體 → 簡體 | 軟體 → 软件 |
| `tw2t` | 台灣正體 → OpenCC 標準繁體 | 吃飯 → 喫飯 |
| `hk2s` | 香港繁體 → 簡體 | 打印機 → 打印机 |
| `hk2t` | 香港繁體 → OpenCC 標準繁體 | 為 → 爲 |
| `t2s` | OpenCC 標準繁體 → 簡體 | 繁體 → 繁体 |
| `t2s_cngov` | OpenCC 標準繁體 → 大陸政府標準簡體 | 潮溼 → 潮湿 |
| `t2tw` | OpenCC 標準繁體 → 台灣正體 | 牀 → 床 |
| `t2hk` | OpenCC 標準繁體 → 香港繁體 | 爲 → 為 |
| `t2cngov` | 繁體 → 大陸政府標準繁體 | 潮溼 → 潮湿 |
| `t2cngov_keep_simp` | 繁體 → 大陸政府標準繁體（保留簡體） | 简体繁體 → 简体繁體 |
| `t2cngov_jieba` | 繁體 → 大陸政府標準繁體（Jieba 分詞） | 測試简体混繁體 → 測試簡體混繁體 |
| `t2cngov_keep_simp_jieba` | 繁體 → 大陸政府標準繁體（保留簡體，Jieba 分詞） | 測試简体混繁體 → 測試简体混繁體 |

香港常用詞設定檔已隨包提供，但比照上游仍在開發中，歡迎補充詞組：

| 設定檔 | 說明 | 範例 |
|--------|------|------|
| `s2hkp` | 簡體 → 香港繁體（含香港常用詞彙） | 软件 → 軟件 |
| `s2hkp_jieba` | 簡體 → 香港繁體（含香港常用詞彙，Jieba 分詞） | 服务器软件 → 伺服器軟件 |
| `hk2sp` | 香港繁體 → 簡體（含中國大陸常用詞彙） | 軟件 → 软件 |
| `hk2sp_jieba` | 香港繁體 → 簡體（含中國大陸常用詞彙，Jieba 分詞） | 伺服器軟件 → 服务器软件 |

日文漢字設定檔已隨包提供，但比照上游僅供探索性研究，不建議用於生產環境：

| 設定檔 | 說明 | 範例 |
|--------|------|------|
| `t2jp` | 日文舊字體 → 日文新字體 | 櫻花 → 桜花 |
| `jp2t` | 日文新字體 → 日文舊字體，並將少量日文詞組轉換為對應中文 | 桜花 → 櫻花 |

#### 方式 2：使用 `from`/`to` 參數（与 `opencc-js` 相容）

指定來源和目標語系：

```javascript
const converter = OpenCC.Converter({ from: "cn", to: "twp" });
const result = await converter("服务器");  // 伺服器
```

**語系代碼：**

| 代碼 | 說明 |
|------|------|
| `cn` | 簡體中文（中國大陸） |
| `tw` | 繁體中文（台灣） |
| `twp` | 台灣正體（含慣用詞） |
| `hk` | 繁體中文（香港） |
| `hkp` | 香港繁體（含慣用詞） |
| `t` | 繁體中文（通用） |
| `s` | 簡體中文（別名） |
| `sp` | 簡體（含慣用詞） |
| `jp` | 日文新字體 |

**兩種方式功能完全相同！** 選擇您喜歡的即可。

## 📦 內建資料版本

- OpenCC 上游：`71964afa6c7f`
- 大陸政府標準詞典：`Transformer(1.3.7)`（`da403c620a17`）
- 發行資源已用目前隨附的設定檔與 `.ocd2` 詞典重新產生到 `dist/data/`。

### OpenCC.ConverterFactory() - 含自訂字典的轉換器

```javascript
const converter = OpenCC.ConverterFactory(
  "cn",        // from
  "tw",        // to
  [            // 自訂字典
    [["服务器", "伺服器"], ["文件", "檔案"]],
    "網路 网络 | 檔案 文件"
  ]
);

const result = await converter("服务器上的文件通过网络传输");
// 輸出：伺服器上的檔案通過網路傳輸
```

### OpenCC.CustomConverter() - 純自訂轉換器

```javascript
const converter = OpenCC.CustomConverter([
  [""", "「"],
  [""", "」"],
  ["'", "『"],
  ["'", "』"],
]);

const result = converter("这是"引号"和'单引号'");
// 輸出：这是「引号」和『单引号』
```

## 💡 使用範例

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
      <button onClick={handleConvert}>轉換</button>
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
  <button @click="handleConvert">轉換</button>
  <div>{{ output }}</div>
</template>
```

### Node.js CLI 工具

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
  console.log('結果：', e.data);
};

worker.postMessage({ config: 's2tw', text: '简体中文' });
```

## 🔧 最佳實務

### ✅ 重複使用轉換器實例

```javascript
// ✅ 好：建立一次，多次使用
const converter = OpenCC.Converter({ config: "s2tw" });

for (const text of manyTexts) {
  await converter(text);  // 快！
}
```

```javascript
// ❌ 避免：每次都建立新實例
for (const text of manyTexts) {
  const converter = OpenCC.Converter({ config: "s2tw" });  // 慢！
  await converter(text);
}
```

### 多個轉換器（自動快取）

```javascript
// 建立多個轉換器（資源自動快取）
const s2t = OpenCC.Converter({ config: "s2t" });
const s2tw = OpenCC.Converter({ config: "s2tw" });
const t2s = OpenCC.Converter({ config: "t2s" });

// 獨立使用
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

## 🏗️ 建置

專案使用兩階段建置流程：

### 階段 1：建置 WASM

```bash
./build.sh
```

編譯 OpenCC + marisa-trie 成 WASM，輸出至 `build/`：
- `build/opencc-wasm.esm.js` - ESM WASM 膠合程式
- `build/opencc-wasm.cjs` - CJS WASM 膠合程式
- `build/opencc-wasm.wasm` - WASM 二進位檔

### 階段 2：建置 API

```bash
node scripts/build-api.js
```

產生可發佈的發行版至 `dist/`：
- 複製 WASM 檔案至 `dist/esm/` 和 `dist/cjs/`
- 轉換原始碼至生產環境路徑
- 複製資料檔至 `dist/data/`

### 完整建置

```bash
npm run build
```

自動執行兩個階段。

## 🧪 測試

```bash
npm test
```

執行上游 OpenCC 測試案例來驗證 WASM 建置。

## 📁 專案結構

```
wasm-lib/
├── build/              ← 中間產物（gitignored）
├── dist/               ← 可發佈版本（已提交）
│   ├── esm/
│   │   ├── index.js
│   │   ├── opencc-wasm.js
│   │   └── opencc-wasm.wasm
│   ├── cjs/
│   │   ├── index.cjs
│   │   ├── opencc-wasm.cjs
│   │   └── opencc-wasm.wasm
│   └── data/           ← OpenCC 設定檔 + 字典
├── index.js            ← 原始碼 API
├── index.d.ts          ← TypeScript 型別定義
└── scripts/
    └── build-api.js    ← 建置腳本
```

## ❓ 常見問題

**Q：設定檔和字典會自動載入嗎？還是需要我手動下載？**

A：自動載入！高階 API（`OpenCC.Converter()`）會自動從 CDN 下載所有需要的檔案。

**Q：每次轉換都會重新下載嗎？**

A：不會！資源在首次載入後會快取起來。

**Q：可以離線使用嗎？**

A：可以！透過 npm 安裝時，所有資源都已包含在套件中。瀏覽器環境可使用 Service Worker 實現離線快取。

**Q：應該用 `config` 還是 `from`/`to` 參數？**

A：兩者功能完全相同。如果您熟悉 OpenCC 設定檔名稱，用 `config`；若偏好語系導向的方式，用 `from`/`to`。

**Q：為什麼第一次轉換比較慢？**

A：首次載入需要下載設定檔和字典檔（約 1-2MB）。後續轉換會很快（已快取）。

## 📝 注意事項

- 使用持久的 OpenCC 控制代碼避免重複載入設定
- 字典儲存在虛擬檔案系統的 `/data/dict/` 中
- 記憶體按需成長（`ALLOW_MEMORY_GROWTH=1`）
- 效能：專注於精確度和與官方 OpenCC 的相容性。原始吞吐量可能比純 JavaScript 實作慢，但保證完整的 OpenCC 行為。

## 📜 變更歷史

### 0.10.0 - 2026-06-29

- 將隨附資源對齊 **OpenCC 1.3.2**（設定檔新增 `normalization` 預處理步驟，並隨附 `STPhrases_GeneratedFromRegionalPhrases` 詞典）
- 大陸政府標準詞典更新到 `80a8b40`（新增來自《古代漢語詞典》第3版的表外異體字）
- 修正 normalization 詞典載入問題：`normalization` 陣列中引用的 ocd2 檔案現在會在呼叫 `opencc_create` 前掛載到 WASM VFS（舊版對 `s2twp`、`s2hkp` 等設定會丟出找不到檔案的錯誤）
- 修正 build：在 Emscripten 來源清單中補上 `SingleStageConverter.cpp` 和 `PipelineConverter.cpp`（上游將 `Converter` 拆分後必要）
- `converter.inspect()` 現在會回傳 `pipelineStages`，並始終從最末 pipeline stage 的 segments 填充頂層 `segments` 欄位
- TypeScript：`InspectionResult` 新增選用欄位 `pipelineStages?: InspectionResult[]`

### 0.9.0 - 2026-06-15

- 將隨附資源對齊 OpenCC 上游 `71964afa6c7f`
- 大陸政府標準詞典更新到 `Transformer(1.3.7)`（`da403c620a17`）
- 隨包提供上游香港常用詞轉換設定：`s2hkp`、`hk2sp`，以及對應 Jieba 變體；這些設定仍在開發中
- 新增隨附的 `s2t_cngov`、`t2s_cngov` 設定並刷新 wasm 詞典資源
- 配合上游 resource/dictionary 拆分更新 wasm build input，並重新產生可發布的 `dist/` 產物

### 0.8.1 - 2026-04-22

- 修正發布流程，讓 `npm run build` / `prepack` 會先刷新資源，再產生 `dist`
- 確保已發布套件會包含 `jieba_merged.ocd2`
- 補上 `t2cngov_jieba` 與 `t2cngov_keep_simp_jieba` 的使用說明

### 0.8.0 - 2026-04-22

- 在 WASM API 中新增 `converter.inspect(text)`，可回傳分詞結果、每個階段的轉換輸出，以及最終輸出的結構化 JSON
- 從 Emscripten 模組匯出新的 inspect 入口，並重新產生可發布的 `dist/` 產物
- 補上 inspect 流程的型別、測試與文件

### 0.7.0 - 2026-04-13

- 將 wasm 分支重新 rebase 到 upstream `master`
- WASM 的 Jieba 支援改為直接復用上游插件實作
- 在 WASM 模組內靜態註冊 Jieba 插件，不再依賴動態載入
- 在 `wasm-lib` / `dist` 中重新納入 Jieba 設定、詞典與對照測試
- 重新產生發行產物並完整驗證 Node 測試套件

### 0.6.3 - 2026-03-31

- 與上游狀態對齊並同步 cngov 詞典
- 在字典同步後重新產生可發布的 `dist/` 產物

### 0.6.0 - 2026-01-17

- 新增 Jieba 分詞支援（cppjieba）以改善詞組切分效果
- 新增轉換設定：`s2twp_jieba`、`tw2sp_jieba`
- wasm 發行包內含 Jieba 詞典與模型檔
- 新增 Jieba 對照測試與使用說明

### 0.5.0 - 2026-01-17

- 與上游分支狀態對齊後的重新發布
- 少量詞條修正與小型 bugfixes

### 0.4.2 - 2026-01-09

- 小型 bugfixes 與細節修正

### 0.4.1 - 2026-01-05

- 修正 WASM 載入子目錄詞典（例如 `cngov`）時的目錄建立
- 資產刷新腳本可正確處理巢狀 `.ocd2` 與 config JSON 複製

### 0.4.0 - 2026-01-04

**新增：**
- `Converter()` 新增 `config` 參數，可直接使用 OpenCC 設定檔名稱
- 新增中國政府規範字轉換：`t2cngov`、`t2cngov_keep_simp`
- 新增示範頁與回歸測試，涵蓋新設定

**修正：**
- 修復 s2twp 重複字元問題（issue #950）
- 修正 tw2sp `方程式` 轉換錯誤並同步字典
- 補齊 wasm-lib 發行包中的 cngov 設定與字典

### 0.3.0 - 2026-01-03

**🚨 重大變更：新的發行版佈局**

`.wasm` 檔案已移至與膠合程式同目錄：
- `dist/esm/opencc-wasm.wasm`（舊：`dist/opencc-wasm.esm.wasm`）
- `dist/cjs/opencc-wasm.wasm`（舊：`dist/opencc-wasm.cjs.wasm`）

**新增：**
- CDN 支援，可直接在瀏覽器中使用
- 完整測試套件
- 自動載入設定檔和字典檔

### 0.2.1

- 提供兩種 wasm 檔名以相容性

### 0.2.0

- 從 OpenCC commit [`36c7cbbc`](https://github.com/frankslin/OpenCC/commit/36c7cbbc9702d2a46a89ea7a55ff8ba5656455df) 重新建置
- 新的 dist 佈局，ESM/CJS 分離
- 測試改用 `node:test` 重寫

---

**用 ❤️ 為中文 NLP 社群打造**
