import OpenCC from "../dist/esm/index.js";

const tests = [
  { config: "hk2s.json", input: "滑鼠" },
  { config: "hk2s.json", input: "資訊" },
  { config: "hk2t.json", input: "裏" },
  { config: "hk2t.json", input: "羣" },
  { config: "s2hk.json", input: "鼠标" },
  { config: "s2hk.json", input: "信息" },
  { config: "s2tw.json", input: "鼠标" },
  { config: "s2tw.json", input: "软件" },
  { config: "s2tw.json", input: "信息" },
  { config: "t2hk.json", input: "里" },
  { config: "t2hk.json", input: "群" },
  { config: "tw2s.json", input: "滑鼠" },
  { config: "tw2s.json", input: "軟體" },
  { config: "tw2s.json", input: "資訊" },
];

for (const { config, input } of tests) {
  const converter = OpenCC.Converter({ config });
  const output = await converter(input);
  console.log(`${config}: "${input}" → "${output}"`);
}
