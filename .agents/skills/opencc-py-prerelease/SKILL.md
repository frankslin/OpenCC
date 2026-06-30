---
name: opencc-py-prerelease
description: >
  Pre-release inspection checklist for the opencc-py pure Python package.
  Invoke before publishing to PyPI to verify version pins, test suite, feature
  parity with the target OpenCC version, and build integrity.
  Trigger on requests like "check release readiness for opencc-py", "pre-release
  check for opencc-py", or "/opencc-py-prerelease".
---

# opencc-py Pre-Release Inspection

Run every check below in order. Report pass/fail for each item.
The worktree to inspect is `/tmp/opencc-wasm-develop`; all paths below are
relative to it unless otherwise stated.

---

## 1. Version pins

Read `python-pure/setup.py` and `python-pure/tests/requirements_lock.txt`.

**Checks:**
- `OPENCC_DATA_VERSION` in `setup.py` must not contain `.dev`.
- `opencc-data==` in `requirements_lock.txt` must equal `OPENCC_DATA_VERSION` exactly.

If either fails, update the offending file before proceeding.

---

## 2. opencc-data availability on PyPI

Verify the target `opencc-data` version is actually published:

```bash
pip index versions opencc-data 2>/dev/null | grep -o 'OPENCC_DATA_VERSION'
# or:
pip install "opencc-data==OPENCC_DATA_VERSION" --dry-run 2>&1 | head -5
```

Replace `OPENCC_DATA_VERSION` with the value from `setup.py`.
Fail if the version is not found — publishing `opencc-py` before `opencc-data`
is live will break installs.

---

## 3. Full test suite

```bash
cd /tmp/opencc-wasm-develop
pip install -r python-pure/tests/requirements_lock.txt -q
PYTHONPATH=python-pure python -m pytest python-pure/tests/ -v
```

All tests must pass (both `test_opencc.py` and `test_opencc_golden.py`).

---

## 4. CONFIGS smoke test

```bash
PYTHONPATH=/tmp/opencc-wasm-develop/python-pure python3 -c "
import opencc
configs = opencc.CONFIGS
print(f'{len(configs)} configs loaded')
print(sorted(configs))
assert len(configs) >= 10, 'Too few configs — opencc-data may be wrong version'
"
```

Verify the count is reasonable and the expected configs (`s2t`, `t2s`, `s2tw`,
`s2twp`, `s2hk`, `s2hkp`, `hk2s`, `hk2sp`, `tw2s`, `tw2sp`) are all present.

---

## 5. Feature parity with target OpenCC version

Read `NEWS.md` at the root of the repo (the OpenCC changelog, not the wasm
changelog). Find the section for the OpenCC version that `opencc-data` packages.

For each feature listed in that section, verify one of:
- It is implemented in `python-pure/opencc/_opencc_pure.py`, OR
- It is documented as out of scope in the "Differences from the Official
  Implementation" section of `python-pure/README.md`.

Known implemented features as of 1.3.2 (do not re-verify these):
- `normalization` config field
- `match_policy: union`
- `include_tofu_risk_dictionaries`
- `s2hkp` / `hk2sp` configs (via opencc-data)
- JSONC config parsing (`//`, `/* */`, trailing commas)
- Inline dictionaries (`{"type": "inline", "entries": {...}}`)

Flag any feature in NEWS.md that is neither implemented nor documented as
out of scope.

---

## 6. Dry-run build

```bash
pip install build -q
python -m build --sdist --wheel --outdir /tmp/opencc-py-dist /tmp/opencc-wasm-develop/python-pure
ls -lh /tmp/opencc-py-dist/
```

Both a `.tar.gz` (sdist) and a `.whl` (wheel) must be produced without errors.

---

## Summary

Report results as a table:

| Check | Status | Notes |
|---|---|---|
| Version pins | ✓/✗ | |
| opencc-data on PyPI | ✓/✗ | |
| Test suite | ✓/✗ | N passed / M failed |
| CONFIGS smoke test | ✓/✗ | N configs |
| Feature parity | ✓/✗ | any gaps |
| Dry-run build | ✓/✗ | |

Only proceed to publish if all six are ✓.
