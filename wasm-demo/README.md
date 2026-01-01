# wasm-demo：OpenCC WASM 示範站

本目錄提供一個基於發佈套件 `opencc-wasm` 的瀏覽器示範：載入設定與字典、執行轉換、跑測試。

## 準備
- 先在 `wasm-demo` 根目錄執行 `npm install`，確認本目錄的 `node_modules/opencc-wasm` 可用。

## 檔案概覽
- `index.html`：新版經典介面（類似 https://opencc.byvoid.com/ ），按鈕式選原文／目標／異體字／地域用詞，動態載入設定與 `.ocd2`（寫入 `/data/config`、`/data/dict`），內建測試入口、複製、快捷鍵等。
- `wasm.html`：早期的 WASM API 示範頁，直接呼叫 `opencc_create/opencc_convert`，可手動載入設定並跑測試。
- `public-api.html`：使用 `opencc-wasm` 提供的 opencc-js 相容 API 的示範頁，方便對照官方 JS API。
- `benchmark.html`：效能對比頁（WASM vs opencc-js，需本機有 opencc-js 才會載入；WASM 重點在行為一致性而非效能）。
- `testcases.json`：自 `../test/testcases` 產出的用例（如需重生，可用 `wasm-lib/scripts/gen_testcases_json.py` 輸出到本目錄）。
- `vendor/opencc-wasm/`：透過 `npm run prepare:assets` 從已安裝的 `opencc-wasm` 套件複製的構建產物。

## 執行
```bash
cd wasm-demo
npm install      # 安裝相依（包含 opencc-wasm 本地套件）
npm run build    # 複製 dist 到 vendor，方便靜態存取
python3 -m http.server 8000  # 瀏覽器開 http://localhost:8000/wasm-demo/
```
點擊設定按鈕載入字典，再執行轉換或測試。

輸出的 `dist/` 內容可直接用於靜態部署。

## 設定與字典路徑
- 設定 JSON 與字典 `.ocd2` 直接使用套件內的 `node_modules/opencc-wasm/dist/data/config/` 與 `node_modules/opencc-wasm/dist/data/dict/`。
- 頁面載入時把設定寫入 `/data/config/`，字典寫入 `/data/dict/`，並在設定中改寫引用路徑指向 `/data/dict/...`。
