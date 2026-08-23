#!/usr/bin/env bash
set -euo pipefail

# Regenerate wasm-lib assets from Bazel outputs:
#  - data/dictionary/*.ocd2       -> wasm-lib/data/dict/
#  - data/config/*.json + plugins/jieba/data/config/*.json -> wasm-lib/data/config/
#  - test/testcases/testcases.json -> wasm-lib/test/testcases.json
#  - test/testcases/cngov_testcases.json -> wasm-lib/test/cngov_testcases.json
#  - plugins/jieba/tests/data/jieba_comparison_testcases.json -> wasm-lib/test/jieba_comparison_testcases.json
#  - plugins/jieba/deps/cppjieba/dict/*.utf8 + Bazel-built jieba_merged.ocd2 -> wasm-lib/data/jieba_dict/

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/.."

echo "Building dictionaries via Bazel..."
bazel build //data/dictionary:binary_dictionaries
bazel build //plugins/jieba:jieba_merged_dict

BAZEL_BIN="$(bazel info bazel-bin)"

DICT_SRC="${BAZEL_BIN}/data/dictionary"
DICT_DST="${ROOT}/data/dict"
mkdir -p "${DICT_DST}"
# Ensure target writable (some checked-in artifacts may be read-only)
chmod -R u+w "${DICT_DST}"
CONFIG_SOURCES=(data/config/*.json plugins/jieba/data/config/*.json)

echo "Collecting required .ocd2 names from config JSON"
NEEDED_DICTS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && NEEDED_DICTS+=("$line")
done <<< "$(
  grep -h -E -o '"file"[[:space:]]*:[[:space:]]*"[^"]*\.ocd2"' "${CONFIG_SOURCES[@]}" \
    | sed -E 's/.*"file"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' | sort -u
)"

while IFS= read -r line; do
  [[ -n "$line" ]] && NEEDED_DICTS+=("$line")
done <<< "$(
  grep -h -E -o '"file"[[:space:]]*:[[:space:]]*"cngov/[^"]*\.txt"' "${CONFIG_SOURCES[@]}" \
    | sed -E 's/.*"file"[[:space:]]*:[[:space:]]*"cngov\/([^"]+)\.txt".*/cngov\/\1.ocd2/' | sort -u
)"

# If no matches (unexpected), fall back to all .ocd2
if [[ ${#NEEDED_DICTS[@]} -eq 0 ]]; then
  echo "No referenced dicts found via config scan; copying all .ocd2"
  while IFS= read -r line; do
    [[ -n "$line" ]] && NEEDED_DICTS+=("$line")
  done <<< "$(cd "${DICT_SRC}" && find . \
    -name '*runfiles*' -prune -o \
    -name '*.ocd2' -print \
    | sed -E 's|^\\./||' | sort -u)"
fi

echo "Refreshing dicts in ${DICT_DST}"
# Clear out any stale files/dirs so only expected .ocd2 remain.
find "${DICT_DST}" -mindepth 1 -exec rm -rf {} +
for f in "${NEEDED_DICTS[@]}"; do
  if [[ "${f}" == *runfiles* ]]; then
    echo "Skipping runfiles entry ${f}" >&2
    continue
  fi
  src="${DICT_SRC}/${f}"
  dst="${DICT_DST}/${f}"
  if [[ ! -f "${src}" ]]; then
    echo "Warning: missing dict source ${src}" >&2
    continue
  fi
  # Handle subdirectory paths like cngov/TGCharacters.ocd2
  mkdir -p "$(dirname "${dst}")"
  install -m 644 "${src}" "${dst}"
done

CONFIG_DST="${ROOT}/data/config"
mkdir -p "${CONFIG_DST}"
chmod -R u+w "${CONFIG_DST}"
rm -f "${CONFIG_DST}"/*.json
echo "Copying config JSON into ${CONFIG_DST}"
install -m 644 "${ROOT}/../data/config"/*.json "${CONFIG_DST}/"
install -m 644 "${ROOT}/../plugins/jieba/data/config"/*.json "${CONFIG_DST}/"
node --input-type=module - "${CONFIG_DST}" <<'NODE'
import fs from "node:fs";
import path from "node:path";

function rewriteDictRefs(node) {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) changed = rewriteDictRefs(item) || changed;
    return changed;
  }
  if (!node || typeof node !== "object") return false;
  if (node.type === "text" && typeof node.file === "string" &&
      node.file.endsWith(".txt")) {
    node.type = "ocd2";
    node.file = node.file.replace(/\.txt$/, ".ocd2");
    changed = true;
  }
  for (const value of Object.values(node)) changed = rewriteDictRefs(value) || changed;
  return changed;
}

const configDir = process.argv[2];
for (const name of fs.readdirSync(configDir)) {
  if (!name.endsWith(".json")) continue;
  const file = path.join(configDir, name);
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  if (rewriteDictRefs(config)) {
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  }
}
NODE

JIEBA_DST="${ROOT}/data/jieba_dict"
JIEBA_SRC="${ROOT}/../plugins/jieba/deps/cppjieba/dict"
JIEBA_MERGED_SRC="${BAZEL_BIN}/plugins/jieba/jieba_dict/jieba_merged.ocd2"
mkdir -p "${JIEBA_DST}"
chmod -R u+w "${JIEBA_DST}"
rm -f "${JIEBA_DST}"/*.utf8 "${JIEBA_DST}/jieba_merged.ocd2"
echo "Copying Jieba resources from ${JIEBA_SRC} -> ${JIEBA_DST}"
install -m 644 "${JIEBA_SRC}"/*.utf8 "${JIEBA_DST}/"
if [[ -f "${JIEBA_MERGED_SRC}" ]]; then
  echo "Copying merged Jieba dictionary from ${JIEBA_MERGED_SRC} -> ${JIEBA_DST}"
  install -m 644 "${JIEBA_MERGED_SRC}" "${JIEBA_DST}/jieba_merged.ocd2"
else
  echo "Warning: missing merged Jieba dictionary ${JIEBA_MERGED_SRC}" >&2
fi

CASE_SRC="${ROOT}/../test/testcases/testcases.json"
CASE_DST="${ROOT}/test/testcases.json"
mkdir -p "$(dirname "${CASE_DST}")"
# Remove any old JSON to avoid stale copies
rm -f "${CASE_DST}"
echo "Copying testcases.json from ${CASE_SRC} -> ${CASE_DST}"
install -m 644 "${CASE_SRC}" "${CASE_DST}"

CNGOV_CASE_SRC="${ROOT}/../test/testcases/cngov_testcases.json"
CNGOV_CASE_DST="${ROOT}/test/cngov_testcases.json"
echo "Copying cngov_testcases.json from ${CNGOV_CASE_SRC} -> ${CNGOV_CASE_DST}"
install -m 644 "${CNGOV_CASE_SRC}" "${CNGOV_CASE_DST}"

JIEBA_CASE_SRC="${ROOT}/../plugins/jieba/tests/data/jieba_comparison_testcases.json"
JIEBA_CASE_DST="${ROOT}/test/jieba_comparison_testcases.json"
echo "Copying jieba_comparison_testcases.json from ${JIEBA_CASE_SRC} -> ${JIEBA_CASE_DST}"
install -m 644 "${JIEBA_CASE_SRC}" "${JIEBA_CASE_DST}"

# Mirror the refreshed data/ into dist/data/ so the published-layout entry points
# (dist/esm, dist/cjs, and the CDN tests) resolve the same assets without needing
# a full Emscripten build. build-api.js repeats this copy during a real build.
DIST_DATA_DST="${ROOT}/dist/data"
echo "Mirroring ${ROOT}/data -> ${DIST_DATA_DST}"
mkdir -p "$(dirname "${DIST_DATA_DST}")"
chmod -R u+w "${DIST_DATA_DST}" 2>/dev/null || true
rm -rf "${DIST_DATA_DST}"
cp -R "${ROOT}/data" "${DIST_DATA_DST}"

echo "Done."
