# OpenCC WASM Benchmarks

性能基准测试，用于评估 OpenCC WebAssembly 版本的初始化和转换性能。

## 运行 Benchmark

```bash
cd wasm-lib
npm run benchmark
```

或者直接运行：

```bash
node benchmark/performance.js
```

## 测试项目

### 1. 初始化性能测试

测试所有配置文件的加载和初始化时间：
- `hk2s.json`, `hk2t.json`, `jp2t.json`
- `s2hk.json`, `s2t.json`, `s2tw.json`, `s2twp.json`
- `t2hk.json`, `t2jp.json`, `t2s.json`
- `tw2s.json`, `tw2sp.json`, `tw2t.json`

### 2. 转换性能测试

使用 `s2t` 配置测试不同文本长度的转换性能：
- 100 行文本
- 1,000 行文本
- 10,000 行文本（可能受内存限制）

## 基准测试方法

仿照 C++ 版本的 `src/benchmark/Performance.cpp`：

1. **初始化测试**: 测量创建转换器实例的时间
2. **转换测试**: 测量文本转换的时间
3. **统计**: 计算平均值、标准差、迭代次数

每个测试：
- 最少运行 10 次迭代
- 总时间至少 1 秒
- 最多运行 5 秒

## 输出格式

```
OpenCC WASM Performance Benchmark
======================================================================
Node.js version: v22.21.1
Platform: linux x64
======================================================================

Initialization Performance
----------------------------------------------------------------------
Benchmark                                       Time   Iterations
----------------------------------------------------------------------
BM_Initialization/s2t                        7.07 µs     137028 iterations
...

Conversion Performance (s2t)
----------------------------------------------------------------------
Benchmark                                       Time   Iterations
----------------------------------------------------------------------
BM_Convert/100                              2.622 ms        382 iterations
...
```

## 与 C++ 版本对比

详细的性能对比报告见 [BENCHMARK_RESULTS.md](../BENCHMARK_RESULTS.md)。

关键差异：
- **初始化**: WASM 快 200-4800 倍（微秒级 vs 毫秒级）
- **转换**: C++ 快约 4 倍（原生代码优势）
- **内存**: WASM 有文本大小限制（当前约 40KB）

## 注意事项

1. **内存限制**: 当前 WASM 配置对大文本有限制，超过 1000 行可能失败
2. **环境差异**: 浏览器和 Node.js 性能可能不同
3. **缓存效果**: 转换器实例会被重用，后续调用会更快
