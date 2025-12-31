# wasm-demo：OpenCC WebAssembly 起手式

这个目录提供一个最小的 WASM “Hello, OpenCC” 示例，方便后续迭代，把核心库或自定义逻辑搬进浏览器。

## 目录结构
- `src/main.cpp`：导出一个简单的 `hello()` 函数，演示字符串返回。
- `public/index.html`：浏览器端加载编译产物的示例页面。
- `build.sh`：使用 Emscripten (`em++`) 的最小编译指令。

## 前置
- 已安装并激活 Emscripten SDK（`emcc --version` 可用）。
- 当前工作目录为仓库根目录（`wasm-demo` 与 `src` 同级）。

## 构建
```bash
cd wasm-demo
./build.sh
```

编译成功后会在 `wasm-demo/dist/` 生成：
- `opencc-wasm.js`
- `opencc-wasm.wasm`
- `opencc-wasm.data`（若有额外静态资源）

## 运行示例页面
```bash
cd wasm-demo
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080/public
```

## 后续迭代建议
- 将 `src/main.cpp` 的逻辑替换为封装 OpenCC 的 C/C++ API，导出所需接口（如 `convert(configPath, text)`）。
- 若需要加载 `.ocd2`，可在编译时通过 `--preload-file` 把字典文件打包进虚拟文件系统，或在运行时用 `fetch` 写入 `FS`.
- 按需调整 `build.sh` 的 `-s EXPORTED_FUNCTIONS`、`-s ENVIRONMENT=web,worker` 等编译开关，方便在 Web Worker 中运行。

