#!/usr/bin/env bash
#
# Run the OpenCC Google Benchmark suite under CodSpeed.
#
# Only the in-process benchmarks are selected:
#   - BM_Initialization/*      (dictionary/config loading)
#   - BM_ConvertLongText/*     (single long-text conversion)
#   - BM_Convert/*/{100,1000}  (repeated conversion at small scale)
#
# The BM_CommandLine* benchmarks are intentionally excluded: they spawn the
# `opencc` CLI as an external process via std::system, which is not compatible
# with CodSpeed's simulation instrument (it measures the instrumented benchmark
# process itself). The very high iteration counts of BM_Convert (10000, 100000)
# are also excluded to keep the instrumented run time reasonable in CI.
set -euo pipefail

BENCHMARK_BIN="${1:-./build/perf/src/benchmark/performance}"

exec "${BENCHMARK_BIN}" \
  --benchmark_filter='^BM_Initialization/|^BM_ConvertLongText/|^BM_Convert/.*/(100|1000)$'
