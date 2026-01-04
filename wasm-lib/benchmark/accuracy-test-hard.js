/**
 * 困难准确性测试 - 专门测试 opencc-js 词典不全的情况
 */

import OpenCCWasm from "../dist/esm/index.js";
import { Converter as OpenCCJSConverter } from "opencc-js";

// 更困难的测试用例
const hardTestCases = [
  // 台湾特有用词
  { input: "程序", desc: "程序 (TW应为程式)" },
  { input: "软件", desc: "软件 (TW应为軟體)" },
  { input: "硬件", desc: "硬件 (TW应为硬體)" },
  { input: "鼠标", desc: "鼠标 (TW应为滑鼠)" },
  { input: "打印机", desc: "打印机 (TW应为印表機)" },
  { input: "计算机", desc: "计算机 (TW应为電腦)" },
  { input: "服务器", desc: "服务器 (TW应为伺服器)" },
  { input: "笔记本电脑", desc: "笔记本电脑 (TW应为筆記型電腦)" },
  { input: "台式机", desc: "台式机 (TW应为桌上型電腦)" },
  { input: "网络", desc: "网络 (TW应为網路)" },
  { input: "信息", desc: "信息 (TW应为資訊)" },
  { input: "激光", desc: "激光 (TW应为雷射)" },
  { input: "默认", desc: "默认 (TW应为預設)" },
  { input: "视频", desc: "视频 (TW应为視訊/影片)" },
  { input: "出租车", desc: "出租车 (TW应为計程車)" },
  { input: "公交车", desc: "公交车 (TW应为公車)" },
  { input: "地铁", desc: "地铁 (TW应为捷運)" },

  // 生僻地名
  { input: "克罗地亚", desc: "克罗地亚 (TW应为克羅埃西亞)" },
  { input: "悉尼", desc: "悉尼 (TW应为雪梨)" },
  { input: "墨尔本", desc: "墨尔本 (TW应为墨爾本)" },
  { input: "新西兰", desc: "新西兰 (TW应为紐西蘭)" },
  { input: "冰岛", desc: "冰岛 (TW应为冰島)" },

  // 专业术语
  { input: "人工智能", desc: "人工智能" },
  { input: "深度学习", desc: "深度学习" },
  { input: "机器学习", desc: "机器学习" },
  { input: "神经网络", desc: "神经网络" },
  { input: "算法", desc: "算法" },
  { input: "数据库", desc: "数据库 (TW应为資料庫)" },
  { input: "操作系统", desc: "操作系统" },

  // 组合词（可能有词组优先）
  { input: "鼠标驱动程序", desc: "鼠标驱动程序" },
  { input: "计算机网络安全", desc: "计算机网络安全" },
  { input: "软件开发工程师", desc: "软件开发工程师" },
  { input: "打印机驱动安装失败", desc: "打印机驱动安装失败" },

  // 多音字和歧义
  { input: "干燥", desc: "干燥 (簡→繁)" },
  { input: "干涉", desc: "干涉" },
  { input: "后面", desc: "后面 (簡→繁)" },
  { input: "皇后", desc: "皇后" },

  // 完整句子
  { input: "我用鼠标打开了计算机上的软件程序", desc: "完整句子1" },
  { input: "这个打印机的驱动程序需要更新", desc: "完整句子2" },
  { input: "服务器的硬件配置很高", desc: "完整句子3" },
];

async function testTaiwanSpecific() {
  console.log("OpenCC 台湾用词准确性测试");
  console.log("测试 s2tw.json (简体中文 → 台湾正体)\n");
  console.log("=".repeat(80));

  const wasmConverter = OpenCCWasm.Converter({ config: "s2tw.json" });
  const jsConverter = OpenCCJSConverter({ from: "cn", to: "tw" });

  const differences = [];
  const same = [];

  for (const testCase of hardTestCases) {
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

  console.log(`\n✅ 转换结果相同 (${same.length}/${hardTestCases.length}):\n`);
  same.slice(0, 10).forEach(({ input, result, desc }) => {
    console.log(`  "${input}" → "${result}"`);
  });
  if (same.length > 10) {
    console.log(`  ... 还有 ${same.length - 10} 个相同结果\n`);
  }

  if (differences.length > 0) {
    console.log(`\n❌ 发现差异 (${differences.length}/${hardTestCases.length}):\n`);

    differences.forEach(({ input, wasmResult, jsResult, desc }) => {
      console.log(`📝 ${desc}`);
      console.log(`   输入:         "${input}"`);
      console.log(`   官方 (WASM): "${wasmResult}" ✓`);
      console.log(`   JS 版本:      "${jsResult}" ${wasmResult === jsResult ? '✓' : '✗'}`);

      // 高亮差异
      if (wasmResult !== jsResult) {
        const diff = findDifference(wasmResult, jsResult);
        if (diff) {
          console.log(`   差异: ${diff}`);
        }
      }
      console.log();
    });

    // 分析差异类型
    console.log("\n" + "=".repeat(80));
    console.log("差异分析:\n");

    const taiwanTerms = differences.filter(d =>
      d.desc.includes("TW应为") ||
      ["程序", "软件", "硬件", "鼠标", "打印机", "计算机", "服务器", "网络", "信息"].includes(d.input)
    );

    const placeNames = differences.filter(d => d.desc.includes("地名"));
    const compounds = differences.filter(d => d.input.length > 6);

    if (taiwanTerms.length > 0) {
      console.log(`🇹🇼 台湾特有用词差异: ${taiwanTerms.length} 个`);
      taiwanTerms.forEach(({ input, wasmResult, jsResult }) => {
        console.log(`   "${input}": 官方="${wasmResult}", JS="${jsResult}"`);
      });
      console.log();
    }

    if (placeNames.length > 0) {
      console.log(`🌍 地名翻译差异: ${placeNames.length} 个`);
      placeNames.forEach(({ input, wasmResult, jsResult }) => {
        console.log(`   "${input}": 官方="${wasmResult}", JS="${jsResult}"`);
      });
      console.log();
    }

    if (compounds.length > 0) {
      console.log(`📚 复合词组差异: ${compounds.length} 个`);
      compounds.forEach(({ input, wasmResult, jsResult }) => {
        console.log(`   "${input}"`);
        console.log(`      官方: "${wasmResult}"`);
        console.log(`      JS:   "${jsResult}"`);
      });
      console.log();
    }
  }

  // 总结
  console.log("=".repeat(80));
  console.log("总结:\n");
  const accuracy = ((same.length / hardTestCases.length) * 100).toFixed(1);
  console.log(`准确率: ${accuracy}% (${same.length}/${hardTestCases.length})`);
  console.log(`差异数: ${differences.length}`);

  if (differences.length > 0) {
    console.log(`\n⚠️  opencc-js 在台湾用词上有 ${differences.length} 处差异`);
    console.log(`这些差异主要是因为：`);
    console.log(`  1. 缺少台湾特有的地区词汇转换`);
    console.log(`  2. 缺少完整的短语词典`);
    console.log(`  3. 使用逐字转换而非词组转换`);
  } else {
    console.log(`\n✅ opencc-js 在测试用例上完全准确！`);
  }
}

function findDifference(str1, str2) {
  const diffs = [];
  const len = Math.max(str1.length, str2.length);

  for (let i = 0; i < len; i++) {
    if (str1[i] !== str2[i]) {
      diffs.push(`'${str1[i] || '∅'}' → '${str2[i] || '∅'}' (位置${i})`);
    }
  }

  return diffs.length > 0 ? diffs.join(', ') : null;
}

testTaiwanSpecific().catch(err => {
  console.error("测试失败:", err);
  process.exit(1);
});
