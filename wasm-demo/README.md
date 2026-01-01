# wasm-demo：OpenCC WASM 用法简介

本目录提供一个基于发布包 `opencc-wasm` 的浏览器演示：加载配置与词典、执行转换、运行测试用例。

## 准备
- 先在仓库根执行 `npm install ./wasm-lib`（或从 npm 安装正式包），确保本目录下的 `node_modules/opencc-wasm` 可用。

## 文件概览
- `index.html`：演示页面，使用 `node_modules/opencc-wasm/dist/opencc-wasm.js` 初始化 WASM：
  - 配置按钮：从 `node_modules/opencc-wasm/dist/data/config/*.json` 解析并加载所需 `.ocd2` 到虚拟 FS（配置写 `/data/config/`、词典写 `/data/dict/`），自动填充配置名、焦点跳转。
  - 文本转换：选择配置后调用句柄式 `opencc_convert`，支持一键复制输出。
  - 测试用例：读取本目录的 `testcases.json`，批量加载配置/词典并校验输出，结果汇总在日志框。
  - 统一日志/结果输出区。
- `testcases.json`：从 `../test/testcases` 生成的用例（如需重新生成，可使用 `wasm-demo/scripts/gen_testcases_json.py`，输出到本目录）。

## 运行
```bash
cd wasm-demo
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/wasm-demo/
```
点击配置按钮加载词典，然后执行转换或运行测试用例。

## 配置与词典路径
- 配置 JSON 与字典 `.ocd2` 直接使用包内的 `node_modules/opencc-wasm/dist/data/config/` 与 `node_modules/opencc-wasm/dist/data/dict/`。
- 页面加载时把配置写入 `/data/config/`，词典写入 `/data/dict/`，并在配置中重写引用路径指向 `/data/dict/...`。
