# Changelog

All notable changes to opencc-wasm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.4.2]: https://github.com/frankslin/OpenCC/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/frankslin/OpenCC/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/frankslin/OpenCC/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/frankslin/OpenCC/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/frankslin/OpenCC/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/frankslin/OpenCC/releases/tag/v0.2.0
