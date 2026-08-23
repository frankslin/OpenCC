# opencc-py (OpenCC Pure Python Implementation)

[繁體中文版](README.zh-TW.md)

This directory contains a pure Python implementation of the
[OpenCC](https://github.com/BYVoid/OpenCC) Chinese conversion algorithm. It
provides the same import surface as the Python package:

```python
import opencc

converter = opencc.OpenCC("s2t")
print(converter.convert("汉字"))  # 漢字
```

## Data Dependency

The package does not bundle OpenCC configs or dictionaries directly. Built-in
conversion data is loaded from the
[`opencc-data` PyPI package](https://pypi.org/project/opencc-data/) at runtime.

This keeps the pure Python package small and avoids depending on generated files
under the OpenCC source tree. The converter reads:

- config JSON files from `opencc_data.config_path()`
- dictionary text files from `opencc_data.data_path()`
- test cases from `opencc_data.test_data_path()`

Custom config files are still supported. When a custom config references a local
dictionary path such as `CustomPhrases.ocd2`, the pure Python implementation
looks for the corresponding `CustomPhrases.txt` next to the config file.

## Installation

The PyPI package name is `opencc-py`. Users can install it with pip:

```bash
python -m pip install opencc-py
```

For local development from this directory:

```bash
python -m pip install .
```

The package version matches its `opencc-data` version and declares the matching
data package as an exact install dependency, so pip installs the compatible data
package automatically.

Or use editable development mode:

```bash
python -m pip install -e .
```

## Changelog

Release notes are maintained in OpenCC's NEWS.md:
https://github.com/BYVoid/OpenCC/blob/master/NEWS.md

## Supported Configs

`opencc.CONFIGS` is populated from the configs exposed by `opencc-data`.

```python
import opencc

print(opencc.CONFIGS)
```

The standard mmseg configs and configs that do not require segmentation are
supported. Jieba plugin configs are not included in `opencc-data`, so they are
not exposed as built-in configs by this package.

## Testing

Install test dependencies, then run pytest from the repository root:

```bash
python -m pip install -r python-pure/tests/requirements_lock.txt
PYTHONPATH=python-pure python -m pytest python-pure/tests
```

The tests verify:

- importing and initializing every built-in config
- conversion against `opencc-data` test cases
- custom config and local dictionary resolution
- golden output compatibility for supported configs

## OpenCC 1.3.2 Feature Coverage

The following OpenCC 1.3.2 features are fully supported:

- **CJK Compatibility Ideographs normalization** — all built-in configs include
  a pre-processing normalization step that maps U+F900–U+FAFF characters to
  their canonical code points before conversion.
- **`match_policy: union`** — dictionary groups with `"match_policy": "union"`
  return the globally longest match across all sub-dictionaries.
- **`normalization` config field** — custom configs may add a `normalization`
  array to apply conversion steps before segmentation.
- **New configs** — `s2hkp` and `hk2sp` (Simplified ↔ Hong Kong, with phrase
  conversion) are available through `opencc-data`.
- **Tofu-risk dictionary suppression** — pass
  `include_tofu_risk_dictionaries=False` to `OpenCC()` to exclude dictionaries
  that may produce characters absent from modern CJK fonts.
- **JSONC** — config files may use `//` line comments and `/* */` block
  comments; the pure Python backend strips them before JSON parsing.
- **Inline dictionaries** — `{"type": "inline", "entries": {"key": "value",
  ...}}` dict nodes are supported in custom configs.

## Differences from the Official Implementation

This package intentionally implements only the pieces needed for pure Python
text conversion. Compared with the official C++ library and command-line tools,
it omits several lower-level details. The official Python implementation is the
[`opencc` PyPI package](https://pypi.org/project/opencc/).

- binary dictionary loading for `.ocd2`/`.ocd`; built-in dictionaries are read
  from `.txt` data supplied by `opencc-data`
- dictionary compilation and extraction tools such as `opencc_dict` and
  `opencc_phrase_extract`
- the C API, shared-library loading behavior, and ABI/plugin compatibility
  guarantees
- native CLI behavior, including streaming I/O, command-line option parity, and
  platform-specific path handling
- package, runfiles, and source-tree data discovery fallbacks; built-in data
  comes from `opencc-data`
- automatic loading of optional plugin configs or plugin resources, including
  the Jieba plugin package layout
- performance optimizations from marisa-trie, Darts, and the C++ segmentation
  implementation

The conversion semantics still mirror OpenCC's config-driven pipeline: mmseg
segmentation, ordered dictionary groups, longest-prefix matching within a
dictionary, conversion chains, normalization, and optional suppression of
tofu-risk dictionaries.

## License and Compliance

This package is distributed under the Apache License 2.0.

This project is a derivative work of
[OpenCC](https://github.com/BYVoid/OpenCC). Runtime conversion data is provided
by the [`opencc-data` PyPI package](https://pypi.org/project/opencc-data/).
