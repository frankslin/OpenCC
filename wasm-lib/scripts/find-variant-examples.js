import OpenCC from "../dist/esm/index.js";

// Test some characters that might have variants
const testChars = ["台", "臺", "裏", "裡", "群", "羣", "著", "着", "麪", "麵", "面", "説", "說"];

console.log("=== hk2t.json ===");
const hk2t = OpenCC.Converter({ config: "hk2t.json" });
for (const ch of testChars) {
  const out = await hk2t(ch);
  if (ch !== out) console.log(`"${ch}" → "${out}"`);
}

console.log("\n=== t2hk.json ===");
const t2hk = OpenCC.Converter({ config: "t2hk.json" });
for (const ch of testChars) {
  const out = await t2hk(ch);
  if (ch !== out) console.log(`"${ch}" → "${out}"`);
}
