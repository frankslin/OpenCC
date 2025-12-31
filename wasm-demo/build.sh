#!/usr/bin/env bash
set -euo pipefail

# 输出目录
OUT_DIR="dist"
mkdir -p "${OUT_DIR}"

# 编译选项：
# -s MODULARIZE=1: 生成可按需加载的模块工厂函数
# -s EXPORT_NAME: 自定义工厂函数名，便于前端调用
# -s EXPORTED_FUNCTIONS: 导出 C 接口（需要前缀下划线）
# -s EXPORTED_RUNTIME_METHODS: 暴露 cwrap，便于 JS 侧调用
# -O2: 体积/性能权衡
em++ src/main.cpp \
  -O2 \
  -s WASM=1 \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createOpenCCWasm" \
  -s EXPORTED_FUNCTIONS="['_hello']" \
  -s EXPORTED_RUNTIME_METHODS="['cwrap']" \
  -o "${OUT_DIR}/opencc-wasm.js"

echo "Build complete. Files in ${OUT_DIR}/"
