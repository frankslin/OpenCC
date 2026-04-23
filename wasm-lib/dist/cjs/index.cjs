
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { default: fetchFn = fetch } = {};

const BASE_URL = new (require("node:url").URL)("../", import.meta.url || "file://" + __filename);

const readFileText = (url) => fs.readFileSync(fileURLToPath(url), "utf-8");
const readFileBuffer = (url) => fs.readFileSync(fileURLToPath(url));

const CONFIG_MAP = {
  cn: { t: "s2t.json", tw: "s2tw.json", hk: "s2hk.json", cn: null },
  tw: { cn: "tw2s.json", t: "tw2t.json", tw: null },
  hk: { cn: "hk2s.json", t: "hk2t.json", hk: null },
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
    const wasmUrl = new URL("./opencc-wasm.cjs", import.meta.url || "file://" + __filename);
    const create = require(wasmUrl);
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

async function ensureConfig(configName) {
  if (handles.has(configName)) return handles.get(configName);
  const { mod, api: apiFns } = await getApi();
  mod.FS.mkdirTree("/data/config");
  mod.FS.mkdirTree("/data/dict");
  const cfgUrl = new URL("../data/config/" + configName, BASE_URL);
  const cfgJson = JSON.parse(await fetchText(cfgUrl));

  const dicts = new Set();
  const resources = new Set();
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
  patchPaths(cfgJson.segmentation?.dict);
  if (Array.isArray(cfgJson.conversion_chain)) {
    cfgJson.conversion_chain.forEach((item) => patchPaths(item?.dict));
  }
  mod.FS.writeFile("/data/config/" + configName, JSON.stringify(cfgJson));
  loadedConfigs.add(configName);

  const handle = apiFns.create("/data/config/" + configName);
  if (!handle || handle < 0) throw new Error("opencc_create failed for " + configName);
  handles.set(configName, handle);
  return handle;
}

function resolveConfig(from, to) {
  const f = (from || "").toLowerCase();
  const t = (to || "").toLowerCase();
  const m = CONFIG_MAP[f];
  if (!m || !(t in m)) throw new Error("Unsupported conversion from '" + from + "' to '" + to + "'");
  return m[t];
}

function createConverter({ from, to, config }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  return async (text) => {
    if (configName === null) return text;
    const handle = await ensureConfig(configName);
    const { api: apiFns } = await getApi();
    return apiFns.convert(handle, text);
  };
}

function createInspector({ from, to, config }) {
  let configName;

  if (config) {
    configName = config.endsWith(".json") ? config : `${config}.json`;
  } else if (from && to) {
    configName = resolveConfig(from, to);
  } else {
    throw new Error('Either "config" or both "from" and "to" must be specified');
  }

  return async (text) => {
    if (configName === null) {
      return {
        input: text,
        segments: text.length === 0 ? [] : [text],
        stages: [],
        output: text,
      };
    }
    const handle = await ensureConfig(configName);
    const { api: apiFns } = await getApi();
    return JSON.parse(apiFns.inspect(handle, text));
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
    const converter = (text) => fn(text);
    converter.inspect = (text) => inspect(text);
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
