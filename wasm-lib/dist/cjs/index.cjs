
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { default: fetchFn = fetch } = {};

// CommonJS module: import.meta is a syntax error here, and __filename is always
// defined, so derive the package base from it directly.
const BASE_URL = new (require("node:url").URL)("../", "file://" + __filename);

const readFileText = (url) => fs.readFileSync(fileURLToPath(url), "utf-8");
const readFileBuffer = (url) => fs.readFileSync(fileURLToPath(url));

const CONFIG_MAP = {
  cn: { t: "s2t.json", tw: "s2tw.json", twp: "s2twp.json", hk: "s2hk.json", hkp: "s2hkp.json", cn: null },
  tw: { cn: "tw2s.json", s: "tw2s.json", sp: "tw2sp.json", t: "tw2t.json", tw: null },
  hk: { cn: "hk2s.json", s: "hk2s.json", sp: "hk2sp.json", t: "hk2t.json", hk: null },
  t: { cn: "t2s.json", tw: "t2tw.json", hk: "t2hk.json", jp: "t2jp.json", t: null },
  jp: { t: "jp2t.json" },
};

const loadedConfigs = new Set();
const loadedDicts = new Set();
const loadedResources = new Set();
const handles = new Map();
let modulePromise = null;
let api = null;

async function getModule() {
  if (!modulePromise) {
    // Sibling glue in dist/cjs/; a plain relative require resolves it in CJS.
    const create = require("./opencc-wasm.cjs");
    modulePromise = create();
  }
  return modulePromise;
}

async function getApi() {
  const mod = await getModule();
  if (!api) {
    api = {
      create: mod.cwrap("opencc_create", "number", ["string"]),
      convert: mod.cwrap("opencc_convert", "string", ["number", "string"]),
      inspect: mod.cwrap("opencc_inspect", "string", ["number", "string"]),
      candidates: mod.cwrap("opencc_convert_candidates", "string", ["number", "string"]),
      ambiguities: mod.cwrap("opencc_convert_with_ambiguities", "string", ["number", "string"]),
      destroy: mod.cwrap("opencc_destroy", null, ["number"]),
    };
  }
  return { mod, api };
}

function ensureParentDir(mod, filePath) {
  const idx = filePath.lastIndexOf("/");
  if (idx > 0) {
    const dir = filePath.slice(0, idx);
    mod.FS.mkdirTree(dir);
  }
}

function collectOcd2Files(node, acc) {
  if (!node || typeof node !== "object") return;
  if (node.type === "ocd2" && node.file) acc.add(node.file);
  if (node.type === "group" && Array.isArray(node.dicts)) {
    node.dicts.forEach((d) => collectOcd2Files(d, acc));
  }
}

function collectSegmentationResources(segmentation, acc) {
  if (!segmentation || typeof segmentation !== "object") return;
  const resources = segmentation.resources;
  if (!resources || typeof resources !== "object") return;
  Object.values(resources).forEach((value) => {
    if (typeof value === "string" && value) acc.add(value);
  });
  if (segmentation.type === "jieba") {
    acc.add("jieba_dict/idf.utf8");
    acc.add("jieba_dict/stop_words.utf8");
  }
}

// Tofu-risk dictionary filtering, mirroring node/opencc.js. Default keeps them,
// matching the official OpenCC library APIs.
function filterTofuRiskDicts(dict, includeTofuRiskDictionaries) {
  if (!dict) return null;
  if (dict.type === "inline") return dict;
  if (dict.may_output_tofu && !includeTofuRiskDictionaries) return null;
  if (dict.type === "group" && Array.isArray(dict.dicts)) {
    dict.dicts = dict.dicts
      .map((d) => filterTofuRiskDicts(d, includeTofuRiskDictionaries))
      .filter(Boolean);
    if (dict.dicts.length === 0) return null;
  }
  return dict;
}

function filterTofuRiskConversionChain(config, includeTofuRiskDictionaries) {
  if (!Array.isArray(config.conversion_chain)) return;
  config.conversion_chain = config.conversion_chain
    .map((step) => {
      if (!step || !step.dict) return step;
      step.dict = filterTofuRiskDicts(step.dict, includeTofuRiskDictionaries);
      return step.dict ? step : null;
    })
    .filter(Boolean);
}

async function fetchText(urlObj) {
  if (urlObj.protocol === "file:") return readFileText(urlObj);
  const resp = await fetch(urlObj.href);
  if (!resp.ok) throw new Error("Fetch " + urlObj + " failed: " + resp.status);
  return resp.text();
}
async function fetchBuffer(urlObj) {
  if (urlObj.protocol === "file:") return new Uint8Array(readFileBuffer(urlObj));
  const resp = await fetch(urlObj.href);
  if (!resp.ok) throw new Error("Fetch " + urlObj + " failed: " + resp.status);
  return new Uint8Array(await resp.arrayBuffer());
}

async function ensureConfig(configName, includeTofuRiskDictionaries = true) {
  const cacheKey = configName + "::tofu=" + includeTofuRiskDictionaries;
  if (handles.has(cacheKey)) return handles.get(cacheKey);
  const { mod, api: apiFns } = await getApi();
  mod.FS.mkdirTree("/data/config");
  mod.FS.mkdirTree("/data/dict");
  const cfgUrl = new URL("../data/config/" + configName, BASE_URL);
  const cfgJson = JSON.parse(await fetchText(cfgUrl));

  if (!includeTofuRiskDictionaries) {
    filterTofuRiskConversionChain(cfgJson, includeTofuRiskDictionaries);
  }

  const dicts = new Set();
  const resources = new Set();
  if (Array.isArray(cfgJson.normalization)) {
    cfgJson.normalization.forEach((item) => collectOcd2Files(item?.dict, dicts));
  }
  collectOcd2Files(cfgJson.segmentation?.dict, dicts);
  collectSegmentationResources(cfgJson.segmentation, resources);
  if (Array.isArray(cfgJson.conversion_chain)) {
    cfgJson.conversion_chain.forEach((item) => collectOcd2Files(item?.dict, dicts));
  }
  for (const file of dicts) {
    if (loadedDicts.has(file)) continue;
    const dictUrl = new URL("../data/dict/" + file, BASE_URL);
    const buf = await fetchBuffer(dictUrl);
    const dictPath = "/data/dict/" + file;
    ensureParentDir(mod, dictPath);
    mod.FS.writeFile(dictPath, buf);
    loadedDicts.add(file);
  }
  for (const file of resources) {
    if (loadedResources.has(file)) continue;
    const resourceUrl = new URL("../data/" + file, BASE_URL);
    const buf = await fetchBuffer(resourceUrl);
    const resourcePath = "/data/" + file;
    ensureParentDir(mod, resourcePath);
    mod.FS.writeFile(resourcePath, buf);
    loadedResources.add(file);
  }
  const patchPaths = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "ocd2" && node.file) node.file = "/data/dict/" + node.file;
    if (node.type === "group" && Array.isArray(node.dicts)) node.dicts.forEach(patchPaths);
  };
  if (Array.isArray(cfgJson.normalization)) {
    cfgJson.normalization.forEach((item) => patchPaths(item?.dict));
  }
  patchPaths(cfgJson.segmentation?.dict);
  if (Array.isArray(cfgJson.conversion_chain)) {
    cfgJson.conversion_chain.forEach((item) => patchPaths(item?.dict));
  }
  const vfsConfigName = includeTofuRiskDictionaries ? configName : "notofu." + configName;
  mod.FS.writeFile("/data/config/" + vfsConfigName, JSON.stringify(cfgJson));
  loadedConfigs.add(vfsConfigName);

  const handle = apiFns.create("/data/config/" + vfsConfigName);
  if (!handle || handle < 0) throw new Error("opencc_create failed for " + configName);
  handles.set(cacheKey, handle);
  return handle;
}

function resolveConfig(from, to) {
  const f = (from || "").toLowerCase();
  const t = (to || "").toLowerCase();
  const m = CONFIG_MAP[f];
  if (!m || !(t in m)) throw new Error("Unsupported conversion from '" + from + "' to '" + to + "'");
  return m[t];
}

function createConverter({ from, to, config, includeTofuRiskDictionaries }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  const includeTofu = includeTofuRiskDictionaries !== false;

  return async (text) => {
    if (configName === null) return text;
    const handle = await ensureConfig(configName, includeTofu);
    const { api: apiFns } = await getApi();
    return apiFns.convert(handle, text);
  };
}

function createInspector({ from, to, config, includeTofuRiskDictionaries }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  const includeTofu = includeTofuRiskDictionaries !== false;

  return async (text) => {
    if (configName === null) {
      return {
        input: text,
        segments: text.length === 0 ? [] : [text],
        stages: [],
        output: text,
      };
    }
    const handle = await ensureConfig(configName, includeTofu);
    const { api: apiFns } = await getApi();
    return JSON.parse(apiFns.inspect(handle, text));
  };
}

function createCandidatesFn({ from, to, config, includeTofuRiskDictionaries }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  const includeTofu = includeTofuRiskDictionaries !== false;

  return async (word) => {
    if (configName === null) return [word];
    const handle = await ensureConfig(configName, includeTofu);
    const { api: apiFns } = await getApi();
    return JSON.parse(apiFns.candidates(handle, word));
  };
}

function createAmbiguitiesFn({ from, to, config, includeTofuRiskDictionaries }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  const includeTofu = includeTofuRiskDictionaries !== false;

  return async (text) => {
    if (configName === null) {
      return [{ lit: text }];
    }
    const handle = await ensureConfig(configName, includeTofu);
    const { api: apiFns } = await getApi();
    return JSON.parse(apiFns.ambiguities(handle, text));
  };
}

function CustomConverter(dictOrString) {
  let pairs = [];
  if (typeof dictOrString === "string") {
    pairs = dictOrString
      .split("|")
      .map((seg) => seg.trim())
      .filter(Boolean)
      .map((seg) => seg.split(/\s+/))
      .filter((arr) => arr.length >= 2)
      .map(([a, b]) => [a, b]);
  } else if (Array.isArray(dictOrString)) {
    pairs = dictOrString;
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return (text) => {
    let out = text;
    for (const [src, dst] of pairs) {
      out = out.split(src).join(dst);
    }
    return out;
  };
}

function ConverterFactory(fromLocale, toLocale, extraDicts = []) {
  const conv = createConverter({ from: fromLocale, to: toLocale });
  const extras = extraDicts.map((d) => CustomConverter(d));
  return async (text) => {
    let result = await conv(text);
    extras.forEach((fn) => {
      result = fn(result);
    });
    return result;
  };
}

const OpenCC = {
  Converter(opts) {
    const fn = createConverter(opts);
    const inspect = createInspector(opts);
    const candidates = createCandidatesFn(opts);
    const ambiguities = createAmbiguitiesFn(opts);
    const converter = (text) => fn(text);
    converter.inspect = (text) => inspect(text);
    converter.candidates = (word) => candidates(word);
    converter.convertWithAmbiguities = (text) => ambiguities(text);
    return converter;
  },
  CustomConverter,
  ConverterFactory,
  Locale: {
    from: { cn: "cn", tw: "t", hk: "hk", jp: "jp", t: "t" },
    to: { cn: "cn", tw: "tw", hk: "hk", jp: "jp", t: "t" },
  },
};

module.exports = OpenCC;
module.exports.default = OpenCC;
