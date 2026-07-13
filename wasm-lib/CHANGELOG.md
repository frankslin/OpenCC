# Changelog

All notable changes to opencc-wasm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0] - 2026-07-12

- **Upstream alignment**: Bundled assets now track OpenCC **1.4.1** (`ver.1.4.1`), and the WASM binary is rebuilt against the 1.4.1 source set.
- **CN Government Standard dictionary sync**: Updated bundled cngov dictionaries to `Transformer(1.3.10)` (`512977b`) — picks up the 复/覆 conversion fix, 複流形 in TSPhrases, and 繁转简 表外正字 corrections, and rebuilds the affected `.ocd2` assets.
- **Tofu-risk dictionary option**: `OpenCC.Converter` / `OpenCC.Converter().inspect` accept a new `includeTofuRiskDictionaries` option. It defaults to `true` — keeping dictionaries marked `may_output_tofu`, matching the official OpenCC library APIs (`node/opencc.js` and the Python binding). Set it to `false` to skip them, matching the OpenCC command-line default. Filtering mirrors `node/opencc.js` and is applied in JavaScript before `opencc_create`, so no native rebuild is required to toggle it.
- **TypeScript**: `ConverterOptions` gains an optional `includeTofuRiskDictionaries?: boolean` field.
- **CommonJS entry fix**: `dist/cjs/index.cjs` no longer uses `import.meta`, which made `require("opencc-wasm")` throw at parse time in CommonJS projects. It now derives its base path from `__filename` and requires the sibling glue directly. Added a CJS smoke test (`npm run test:cjs`). ESM/CDN usage was unaffected.

## [0.11.0] - 2026-07-03

- **Upstream alignment**: Bundled assets now track OpenCC **1.4.0** (`ver.1.4.0`), and the WASM binary is rebuilt against the 1.4.0 source set.
- **CN Government Standard dictionary sync**: Updated bundled cngov dictionaries to `Transformer(1.3.9)` (`c41d4af`) — removes incorrectly retained non-《通规》 standard characters (30+ groups), fixes 坏→坯 and related entries, and rebuilds `.ocd2` assets.
- **Build compatibility**: Added `DartsDict.cpp` and the Darts include path to the Emscripten source list, matching 1.4.0 `Config.cpp` linkage.
- **Asset refresh fix**: WASM config rewriting now converts root-level text dictionary references such as `CJK_Compatibility_Ideographs.txt` to bundled `.ocd2` files.

## [0.10.0] - 2026-06-29

- **Upstream alignment**: Bundled assets now track OpenCC **1.3.2** (`ver.1.3.2`). Configs gain a `normalization` pre-processing step (CJK Compatibility Ideographs normalisation) and the new `STPhrases_GeneratedFromRegionalPhrases` dictionary.
- **CN Government Standard dictionary sync**: Updated bundled cngov dictionaries to `80a8b40` (adds a batch of non-standard variant characters sourced from 《古代汉语词典》第3版).
- **Build fix**: Added `SingleStageConverter.cpp` and `PipelineConverter.cpp` to the Emscripten source list (required after `Converter` was split into two concrete subclasses in 1.3.2).
- **Normalization dict loading fix**: `index.js` and the CJS shim now collect and VFS-mount ocd2 files referenced in the `normalization` array before calling `opencc_create`; previously those configs (`s2twp`, `s2hkp`, …) threw a file-not-found error at runtime.
- **Inspect API – pipelineStages**: `opencc_inspect` now serialises `pipelineStages` for `PipelineConverter` results and promotes the last stage's `segments` to the top-level `segments` key, so callers can always read segmentation output from `result.segments` regardless of converter topology.
- **TypeScript**: `InspectionResult` gains an optional `pipelineStages?: InspectionResult[]` field.

## [0.9.0] - 2026-06-15

- **Upstream alignment**: Bundled assets now track OpenCC upstream commit `71964afa6c7f`.
- **CN Government Standard dictionary sync**: Updated bundled cngov dictionaries to `Transformer(1.3.7)` (`da403c620a17`) and keep generated dictionaries aligned with that upstream source.
- **New configs**: Added `s2hkp`, `hk2sp`, `s2hkp_jieba`, `hk2sp_jieba`, `s2t_cngov`, and `t2s_cngov` to wasm assets and generated APIs.
- **Build compatibility**: Updated wasm build inputs for upstream's resource/dictionary implementation split and tightened asset refresh to copy config-referenced `.ocd2` files.
- **Validation**: Regenerated `dist/` artifacts and verified cngov config validation plus the wasm Node/CDN test suite.

## [0.8.1] - 2026-04-22

- **Packaging fix**: `npm run build` / `prepack` now refresh bundled assets before generating `dist/`, so `jieba_merged.ocd2` is included in published packages.
- **Jieba config compatibility**: Adjusted CN Government Standard Jieba configs to use the bundled `user.dict.utf8` resource path.
- **Documentation**: Added README examples for `t2cngov_jieba` and `t2cngov_keep_simp_jieba`.

## [0.8.0] - 2026-04-22

- **Inspect API**: Added `converter.inspect(text)` to the WASM wrapper, returning segmentation, per-stage outputs, and final converted text as structured JSON.
- **WASM export**: Exposed `opencc_inspect` from the Emscripten module and switched the internal handle implementation to `SimpleConverter`.
- **Type definitions**: Added `InspectionResult` / `InspectionStage` typings and documented the new API in both README files.
- **Validation**: Regenerated publishable `dist/` artifacts, added inspect regression tests, and verified `npm test` plus `npm pack --dry-run`.

## [0.7.0] - 2026-04-13

- **Upstream plugin alignment**: Rebases the wasm branch onto upstream `master` and switches Jieba support to reuse the upstream segmentation plugin implementation.
- **Static plugin registration for WASM**: Emscripten builds now register the upstream `jieba` plugin in-process instead of relying on runtime dynamic loading.
- **WASM resource loading**: The runtime now preloads `jieba_dict/*.utf8` resources alongside `.ocd2` dictionaries when a Jieba-backed config is used.
- **Bundled Jieba assets**: `s2twp_jieba.json`, `tw2sp_jieba.json`, Jieba dictionaries, and comparison testcases are included again in `wasm-lib` and `dist/`.
- **Validation**: Regenerated `dist/` artifacts and verified the Node test suite, including Jieba-backed conversion cases.

## [0.6.3] - 2026-03-31

- **Upstream alignment**: Based on `master` tracking upstream OpenCC commit `dfc241c60c287920c82416b52b384ceea5a239ea` (`Build and test OpenCC with Bazel on Windows (#1082)`).
- **Dictionary sync**: Refreshed bundled `cngov` dictionaries to match `Transformer(1.2.8)`.
- **WASM assets**: Rebuilt publishable `dist/` artifacts after the upstream dictionary sync.

## [0.6.0] - 2026-01-17

- **Jieba segmentation**: Added cppjieba-based segmentation support for improved phrase handling.
- **New configs**: Introduced `s2twp_jieba` and `tw2sp_jieba` conversion configs.
- **WASM assets**: Bundled Jieba dictionaries and models with the wasm distribution.
- **Tests/docs**: Added comparison testcases and Jieba usage notes.

## [0.5.0] - 2026-01-17

- **Upstream alignment**: Re-release aligned with upstream branch state.
- **Dictionary tweaks**: Minor entry corrections synced from upstream.
- **Bugfixes**: Small stability and conversion fixes.

## [0.4.2] - 2026-01-09

- **Bugfixes**: Minor fixes and cleanup across the wasm build and assets.

## [0.4.1] - 2026-01-05

- **WASM dict loading**: Ensure parent directories are created before writing subfolder dictionaries (e.g., `cngov/*`).
- **Asset refresh**: Refresh script now handles nested `.ocd2` paths and config JSON copying more reliably.

## [0.4.0] - 2026-01-04

### Added

- **Config-first API**: `Converter()` now accepts `config` for direct OpenCC config names and expanded conversion aliases.
- **CN Government Standard conversions**: New `t2cngov` and `t2cngov_keep_simp` configs, dictionaries, and tests.
- **Demo & tests**: New demo page and additional regression coverage for new conversions.

### Changed

- **Documentation**: Consolidated API docs and expanded usage examples across environments.

### Fixed

- **s2twp duplication bug**: Resolved issue #950 where certain phrases duplicated characters.
- **tw2sp "方程式" regression**: Synced dictionary updates and added regression tests.
- **Package assets**: Included missing cngov configs and dictionaries in wasm-lib distribution.

---

## [0.3.0] - 2026-01-03

### Changed

**🚨 BREAKING: New Distribution Layout**

The `.wasm` files have been moved to be co-located with their corresponding glue code files. This fixes loading issues in various environments and enables proper CDN usage.

**Before (0.2.x):**
```
dist/
  esm/
    index.js
    opencc-wasm.js
  cjs/
    index.cjs
    opencc-wasm.cjs
  opencc-wasm.wasm          ← Was only here
  opencc-wasm.esm.wasm
```

**After (0.3.0):**
```
dist/
  esm/
    index.js
    opencc-wasm.js
    opencc-wasm.wasm        ← Now here (same directory as glue code)
  cjs/
    index.cjs
    opencc-wasm.cjs
    opencc-wasm.wasm        ← Now here (same directory as glue code)
  opencc-wasm.wasm          ← Kept for legacy compatibility
```

**Migration Guide:**

If you were importing the WASM module directly (not the high-level API), no changes are needed. The new layout is automatically handled by the build system.

### Added

- **CDN Support**: Package can now be used directly from CDN (jsDelivr, unpkg, etc.)
  ```javascript
  import OpenCC from "https://cdn.jsdelivr.net/npm/opencc-wasm@0.3.0/dist/esm/index.js";
  ```

- **Comprehensive Test Suite**: Added CDN usage tests
  - `npm test` now runs both core tests (56 cases) and CDN usage tests
  - `npm run test:core` - Run core functionality tests only
  - `npm run test:cdn` - Run CDN usage tests only
  - Added `test/cdn-simple.mjs` - High-level API test
  - Added `test/cdn-usage.mjs` - Low-level WASM API test
  - Added `test/cdn-test.html` - Browser environment test page

- **Documentation**: New comprehensive guides
  - `test/CDN_USAGE.md` - Complete CDN usage guide with examples
  - `test/README.md` - Test suite overview
  - `test/TESTING.md` - Detailed testing guide

### Fixed

- **WASM Loading**: Fixed `.wasm` file not found errors in various bundlers and environments
- **Emscripten Glue Code**: Updated `locateFile` paths to correctly resolve `.wasm` files from the same directory as glue code
- **Build System**: Fixed regex replacement to handle both escaped and literal dots in WASM filename references

### Internal

- Updated `build-api.js` to copy `.wasm` files to both `esm/` and `cjs/` directories
- Updated `index.js` locateFile to use relative paths from glue code location
- Removed obsolete `opencc-wasm.esm.wasm` naming

---

## [0.2.1] - 2024-12-xx

### Fixed

- Copy both wasm binaries for compatibility

---

## [0.2.0] - 2024-12-xx

### Changed

- Initial WASM distribution structure

---

## [Unreleased]

*No unreleased changes*

---

[0.11.0]: https://github.com/frankslin/OpenCC/compare/opencc-wasm-v0.10.0...opencc-wasm-v0.11.0
[0.10.0]: https://github.com/frankslin/OpenCC/compare/opencc-wasm-v0.9.0...opencc-wasm-v0.10.0
[0.9.0]: https://github.com/frankslin/OpenCC/compare/v0.8.2...v0.9.0
[0.4.2]: https://github.com/frankslin/OpenCC/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/frankslin/OpenCC/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/frankslin/OpenCC/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/frankslin/OpenCC/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/frankslin/OpenCC/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/frankslin/OpenCC/releases/tag/v0.2.0
