# wasm-demo：OpenCC WASM 用法简介

本目录提供了一个可运行的浏览器端 OpenCC WASM 演示：加载配置与词典、执行转换、运行测试用例。

## 文件概览
- `build.sh`：Emscripten 构建脚本，编译 OpenCC + marisa 源码并导出 `_convert_text`，产物写入 `dist/`。
- `src/main.cpp`：仅导出 `convert_text(configPath, input)`，调用 OpenCC C API。编译时通过 `OPENCC_WASM_WITH_OPENCC` 开关启用。
- `public/index.html`：前端界面，包含：
  - 配置按钮：从 `/public/config/*.json` 解析并加载所需 `.ocd2` 到虚拟 FS `/data/config/`，自动填充配置名、焦点跳转。
  - 文本转换：选择配置后调用 `convert_text`，支持一键复制输出。
  - 测试用例：读取 `/public/testcases.json`，批量加载配置/词典并校验输出，结果汇总在日志框。
  - 统一日志/结果输出区。
- `public/` 目录：静态资源、配置、词典放置位置（需自行放入 `config/*.json`、`data/*.ocd2`、`testcases.json`）。
- `scripts/gen_testcases_json.py`：从 `../test/testcases` 读取 `.in/.ans` 对行生成 `public/testcases.json`（结构为 `{config, input, expected}` 列表）。
- `dist/`：构建产物 `opencc-wasm.js/.wasm`（由 `build.sh` 生成）。

## 前置
- 已安装并激活 Emscripten（`emcc --version` 可用）。
- 从仓库根目录运行，`wasm-demo` 与 `src/` 同级。

## 构建
```bash
cd wasm-demo
./build.sh
```
产物写入 `dist/`。

## 运行
```bash
cd wasm-demo
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/public/
```
在页面点击配置按钮加载词典，然后执行转换或运行测试用例。

## 生成测试用例 JSON
```bash
cd wasm-demo
python scripts/gen_testcases_json.py ../test/testcases > public/testcases.json
```
生成的 `testcases.json` 会被前端“运行测试”按钮读取。

## 配置与词典放置
- 将配置 JSON 放在 `public/config/`，词典 `.ocd2` 放在 `public/data/`（与配置中的文件名一致）。
- 页面加载时会把配置及引用的词典写入虚拟 FS 的 `/data/config/`。

## 直接在 JS 中使用 dist/ 的调用示例
```js
import createOpenCCWasm from "./dist/opencc-wasm.js"; // 路径按实际调整

const Module = await createOpenCCWasm();

// 将配置和词典写入虚拟 FS（示例使用 /data/config 目录）
Module.FS.writeFile("/data/config/s2t.json", cfgTextOrBytes);
Module.FS.writeFile("/data/config/STPhrases.ocd2", ocd2Bytes);
Module.FS.writeFile("/data/config/STCharacters.ocd2", ocd2Bytes2);

// 绑定导出的函数（本构建只导出 convert_text）
const convert = Module.cwrap("convert_text", "string", ["string", "string"]);

// 调用转换：传入配置路径和待转换文本
const result = convert("/data/config/s2t.json", "汉字");
console.log(result); // => "漢字"
```
- `createOpenCCWasm` 返回 Promise，确保等待加载完成。
- 配置路径需与写入 FS 的路径一致；默认放在 `/data/config/`。
- 如果需要导出更多函数，可在 `build.sh` 的 `EXPORTED_FUNCTIONS` 中添加。
