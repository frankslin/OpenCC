/**
 * Accuracy Comparison: opencc-js vs opencc-wasm
 *
 * 测试 opencc-js 由于词典精简导致的转换错误
 */

import OpenCCWasm from "../dist/esm/index.js";
import { Converter as OpenCCJSConverter } from "opencc-js";

// 测试用例：各种可能出现差异的场景
const testCases = [
  // 1. 专业术语
  { input: "计算机", desc: "专业术语 - 计算机" },
  { input: "打印机", desc: "专业术语 - 打印机" },
  { input: "服务器", desc: "专业术语 - 服务器" },
  { input: "鼠标", desc: "专业术语 - 鼠标" },
  { input: "硬件", desc: "专业术语 - 硬件" },
  { input: "软件", desc: "专业术语 - 软件" },
  { input: "程序", desc: "专业术语 - 程序" },

  // 2. 地名
  { input: "悉尼", desc: "地名 - 悉尼" },
  { input: "墨尔本", desc: "地名 - 墨尔本" },
  { input: "新西兰", desc: "地名 - 新西兰" },
  { input: "克罗地亚", desc: "地名 - 克罗地亚" },
  { input: "乌克兰", desc: "地名 - 乌克兰" },

  // 3. 常用词汇
  { input: "信息", desc: "常用词 - 信息" },
  { input: "网络", desc: "常用词 - 网络" },
  { input: "激光", desc: "常用词 - 激光" },
  { input: "默认", desc: "常用词 - 默认" },

  // 4. 组合短语
  { input: "鼠标驱动程序", desc: "组合 - 鼠标驱动程序" },
  { input: "打印机驱动", desc: "组合 - 打印机驱动" },
  { input: "计算机网络", desc: "组合 - 计算机网络" },
  { input: "软件开发", desc: "组合 - 软件开发" },
  { input: "硬盘驱动器", desc: "组合 - 硬盘驱动器" },

  // 5. 地区差异词汇
  { input: "出租车", desc: "地区词 - 出租车" },
  { input: "视频", desc: "地区词 - 视频" },
  { input: "博客", desc: "地区词 - 博客" },
  { input: "鼠标垫", desc: "地区词 - 鼠标垫" },

  // 6. 复杂句子
  { input: "我的鼠标驱动程序需要更新", desc: "句子1" },
  { input: "这台打印机的硬件有问题", desc: "句子2" },
  { input: "计算机网络连接不上", desc: "句子3" },
  { input: "软件开发需要很多时间", desc: "句子4" },

  // 7. 数字和标点混合
  { input: "Windows 10操作系统", desc: "混合 - 操作系统" },
  { input: "iPhone 15手机", desc: "混合 - 手机" },

  // 8. 成语和俗语
  { input: "鼠目寸光", desc: "成语 - 鼠目寸光" },
  { input: "胆小如鼠", desc: "成语 - 胆小如鼠" },
];

async function compareConversions(config, jsFrom, jsTo) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`测试配置: ${config} (${jsFrom} → ${jsTo})`);
  console.log(`${"=".repeat(80)}\n`);

  // 创建转换器
  const wasmConverter = OpenCCWasm.Converter({ config });
  const jsConverter = OpenCCJSConverter({ from: jsFrom, to: jsTo });

  const differences = [];
  const same = [];

  for (const testCase of testCases) {
    const wasmResult = await wasmConverter(testCase.input);
    const jsResult = jsConverter(testCase.input);

    if (wasmResult !== jsResult) {
      differences.push({
        ...testCase,
        wasmResult,
        jsResult,
      });
    } else {
      same.push({
        ...testCase,
        result: wasmResult,
      });
    }
  }

  // 打印相同的结果
  console.log(`✅ 转换结果相同 (${same.length}/${testCases.length}):\n`);
  same.forEach(({ input, result, desc }) => {
    console.log(`  "${input}" → "${result}" (${desc})`);
  });

  // 打印不同的结果
  if (differences.length > 0) {
    console.log(`\n❌ 转换结果不同 (${differences.length}/${testCases.length}):\n`);
    differences.forEach(({ input, wasmResult, jsResult, desc }) => {
      console.log(`  输入: "${input}" (${desc})`);
      console.log(`    opencc-wasm (官方): "${wasmResult}"`);
      console.log(`    opencc-js:          "${jsResult}"`);
      console.log(`    差异: ${highlightDiff(wasmResult, jsResult)}`);
      console.log();
    });
  }

  return { differences, same };
}

function highlightDiff(str1, str2) {
  const diffs = [];
  const maxLen = Math.max(str1.length, str2.length);

  for (let i = 0; i < maxLen; i++) {
    if (str1[i] !== str2[i]) {
      diffs.push(`位置${i}: '${str1[i] || '(空)'}' vs '${str2[i] || '(空)'}'`);
    }
  }

  return diffs.length > 0 ? diffs.join(', ') : '无差异';
}

async function runAccuracyTests() {
  console.log("OpenCC 准确性对比测试");
  console.log("对比 opencc-js (精简词典) vs opencc-wasm (官方完整词典)\n");

  const configs = [
    { config: "s2t.json", jsFrom: "cn", jsTo: "t", name: "简体→繁体" },
    { config: "s2tw.json", jsFrom: "cn", jsTo: "tw", name: "简体→台湾繁体" },
  ];

  const results = {};

  for (const { config, jsFrom, jsTo, name } of configs) {
    results[name] = await compareConversions(config, jsFrom, jsTo);
  }

  // 总结
  console.log(`\n${"=".repeat(80)}`);
  console.log("总结");
  console.log(`${"=".repeat(80)}\n`);

  for (const [name, { differences, same }] of Object.entries(results)) {
    const total = differences.length + same.length;
    const accuracy = ((same.length / total) * 100).toFixed(1);
    console.log(`${name}:`);
    console.log(`  准确率: ${accuracy}% (${same.length}/${total})`);
    console.log(`  差异数: ${differences.length}`);
    console.log();
  }

  // 详细差异分析
  console.log("差异类型分析:");
  const allDiffs = Object.values(results).flatMap(r => r.differences);

  if (allDiffs.length === 0) {
    console.log("  🎉 未发现差异！opencc-js 在测试用例上完全准确。");
  } else {
    console.log(`  总共发现 ${allDiffs.length} 个差异`);
    console.log("\n  常见差异类型:");

    // 分析差异模式
    const patterns = {
      singleChar: allDiffs.filter(d => d.input.length === 1),
      compound: allDiffs.filter(d => d.input.length > 4),
      technical: allDiffs.filter(d => d.desc.includes("专业术语")),
      regional: allDiffs.filter(d => d.desc.includes("地区")),
      place: allDiffs.filter(d => d.desc.includes("地名")),
    };

    if (patterns.singleChar.length > 0) {
      console.log(`    - 单字转换: ${patterns.singleChar.length} 个`);
    }
    if (patterns.technical.length > 0) {
      console.log(`    - 专业术语: ${patterns.technical.length} 个`);
    }
    if (patterns.regional.length > 0) {
      console.log(`    - 地区差异: ${patterns.regional.length} 个`);
    }
    if (patterns.place.length > 0) {
      console.log(`    - 地名翻译: ${patterns.place.length} 个`);
    }
    if (patterns.compound.length > 0) {
      console.log(`    - 复合词组: ${patterns.compound.length} 个`);
    }
  }
}

// 运行测试
runAccuracyTests().catch(err => {
  console.error("测试失败:", err);
  process.exit(1);
});
