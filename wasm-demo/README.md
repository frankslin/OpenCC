# wasm-demo：OpenCC WASM 用法简介

本目录提供一个基于发布包 `opencc-wasm` 的浏览器演示：加载配置与词典、执行转换、运行测试用例。

## 准备
- 先在仓库根执行 `npm install ./wasm-lib`（或从 npm 安装正式包），确保本目录下的 `node_modules/opencc-wasm` 可用。

## 文件概览
- `index.html`：演示页面，引用 `./vendor/opencc-wasm/opencc-wasm.js` 初始化 WASM（需先运行 `npm run prepare:assets` 复制产物）：
  - 配置按钮：从 `./vendor/opencc-wasm/data/config/*.json` 解析并加载所需 `.ocd2` 到虚拟 FS（配置写 `/data/config/`、词典写 `/data/dict/`），自动填充配置名、焦点跳转。
  - 文本转换：选择配置后调用句柄式 `opencc_convert`，支持一键复制输出。
  - 测试用例：读取本目录的 `testcases.json`，批量加载配置/词典并校验输出，结果汇总在日志框。
  - 统一日志/结果输出区。
- `testcases.json`：从 `../test/testcases` 生成的用例（如需重新生成，可使用 `wasm-lib/scripts/gen_testcases_json.py`，输出到本目录）。
- `vendor/opencc-wasm/`：通过 `npm run prepare:assets` 从已安装的 `opencc-wasm` 包复制的构建产物。
- `benchmark.html`：简单性能对比页（WASM 与 opencc-js，本地有 opencc-js 时可用于对比，但性能不是 WASM 目标；WASM 侧优势在于完整 OpenCC 行为与官方 config/ocd2 一致性）。

## 运行
```bash
cd wasm-demo
npm install             # 安装依赖（包含 opencc-wasm 本地包）
npm run prepare:assets  # 复制 dist 到 vendor，便于静态访问
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/wasm-demo/
```
点击配置按钮加载词典，然后执行转换或运行测试用例。

## 配置与词典路径
- 配置 JSON 与字典 `.ocd2` 直接使用包内的 `node_modules/opencc-wasm/dist/data/config/` 与 `node_modules/opencc-wasm/dist/data/dict/`。
- 页面加载时把配置写入 `/data/config/`，词典写入 `/data/dict/`，并在配置中重写引用路径指向 `/data/dict/...`。
