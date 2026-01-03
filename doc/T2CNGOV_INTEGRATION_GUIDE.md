# t2cngov 整合指南

**将"传统中文→大陆政府标准繁体"转换模式整合进 OpenCC**

---

## 目录

1. [背景介绍](#一背景介绍)
2. [关键决策](#二关键决策)
3. [文件组织](#三文件组织)
4. [整合步骤](#四整合步骤)
5. [测试方案](#五测试方案)
6. [验证清单](#六验证清单)

---

## 一、背景介绍

### 什么是 t2cngov

将各种标准的繁体中文（港、台、混合格式）转换为中国《通用规范汉字表》（2013）定义的**规范繁体字**。

**来源**: [TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards](https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards/tree/main/t2gov)

**核心价值**:
- ✨ 填补 OpenCC "繁体→标准繁体" 转换空白
- 🔧 处理大陆软件输出的简繁混杂文档
- 📐 统一异体繁体字为政府标准

**两种模式**:
- `t2cngov.json`: 全部转为标准繁体（包括简→繁）
- `t2cngov_keep_simp.json`: 保留原有简体字，仅标准化繁体部分

---

## 二、关键决策

### 决策 1：命名方案

**✅ 采用 `t2cngov` 命名**（CN = ISO 3166-1 国家代码）

**理由**:
- 遵循 OpenCC 现有模式（`tw`/`hk` 代表地区）
- 更中立、国际化（避免政治色彩）
- 明确指向"中国政府标准"而非政治实体

**调研结果**:
- ✅ BYVoid/OpenCC 主仓库**无**任何 gov 相关配置
- ✅ **无命名冲突**风险

### 决策 2：词典文件组织 ✨ **新方案**

**✅ 使用子目录隔离第三方词典**

```
data/dictionary/
├── STCharacters.txt          # 官方词典（保持不变）
├── STPhrases.txt
├── ...
└── cngov/                    # 第三方词典子目录 ✨
    ├── TGCharacters.txt
    ├── TGCharacters_keep_simp.txt
    ├── TGPhrases.txt
    ├── GovVariants.txt       # 可选
    └── README.txt            # 子目录说明文件
```

**优点**:
- ✅ 清晰隔离第三方内容，便于管理
- ✅ 方便整体更新（直接替换子目录）
- ✅ 避免污染主词典空间
- ✅ 支持多来源第三方词典（可添加 `data/dictionary/other_project/`）

**技术可行性**:
- ✅ OpenCC 支持路径搜索（`Config.cpp:88-92`）
- ✅ 文件名可包含子路径（如 `"file": "cngov/TGCharacters.ocd2"`）

### 决策 3：配置文件中的版权声明 ✨ **新方案**

**✅ 在 JSON 配置文件中添加元数据字段**

**技术依据**:
- OpenCC 只解析 `name`, `segmentation`, `conversion_chain` 三个字段（`Config.cpp:300-316`）
- **其他字段会被忽略，不影响运行**

**示例配置**（带完整版权声明）:

```json
{
  "name": "Traditional Chinese to CN Government Standard",
  "author": "TerryTian-tech",
  "license": "Apache License 2.0",
  "source": "https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards",
  "contributors": ["TerryTian-tech", "Yi Jianpeng", "Hu Xinmei", "Duan Yatong"],
  "reference": "《通用规范汉字表》(2013)",
  "description": "Converts traditional Chinese to standardized forms defined by China's Table of General Standard Chinese Characters",

  "segmentation": {
    "type": "mmseg",
    "dict": {
      "type": "ocd2",
      "file": "cngov/TGPhrases.ocd2"
    }
  },
  "conversion_chain": [{
    "dict": {
      "type": "group",
      "dicts": [{
        "type": "ocd2",
        "file": "cngov/TGPhrases.ocd2"
      }, {
        "type": "ocd2",
        "file": "cngov/TGCharacters.ocd2"
      }]
    }
  }]
}
```

**优点**:
- ✅ 版权信息与配置文件绑定
- ✅ 用户查看配置时即可看到归属
- ✅ 不影响 OpenCC 运行
- ✅ 符合 JSON 规范（额外字段允许存在）

### 决策 4：测试策略

**✅ 创建独立测试文件**（`test/testcases/cngov_testcases.json`）

**理由**: 避免与上游 `testcases.json` 更新冲突，详见第五章。

### 决策 5：文件处理

**✅ 仅添加 TG 系列文件，跳过 TS 系列**

| 文件 | 来源 | 本仓库状态 | 处理方式 |
|------|------|-----------|----------|
| TSCharacters.txt | TerryTian | ✅ 已存在 4113行 | ❌ **跳过** |
| TSPhrases.txt | TerryTian | ✅ 已存在 278行 | ❌ **跳过** |
| TGCharacters.txt | TerryTian | ❌ 不存在 | ✅ **添加到 cngov/** |
| TGCharacters_keep_simp.txt | TerryTian | ❌ 不存在 | ✅ **添加到 cngov/** |
| TGPhrases.txt | TerryTian | ❌ 不存在 | ✅ **添加到 cngov/** |
| GovVariants.txt | TerryTian | ❌ 不存在 | ⚠️ 可选，添加到 cngov/ |

---

## 三、文件组织

### 目录结构

```
OpenCC/
├── data/
│   ├── config/
│   │   ├── s2t.json
│   │   ├── t2s.json
│   │   ├── t2cngov.json           # 新增 ✨
│   │   └── t2cngov_keep_simp.json # 新增 ✨
│   │
│   └── dictionary/
│       ├── STCharacters.txt         # 官方词典
│       ├── STPhrases.txt
│       ├── ...
│       │
│       └── cngov/                   # 第三方词典子目录 ✨
│           ├── README.txt           # 子目录说明
│           ├── TGCharacters.txt
│           ├── TGCharacters.ocd2    # 编译产物
│           ├── TGCharacters_keep_simp.txt
│           ├── TGCharacters_keep_simp.ocd2
│           ├── TGPhrases.txt
│           └── TGPhrases.ocd2
│
└── test/
    └── testcases/
        ├── testcases.json           # 现有测试（不修改）
        └── cngov_testcases.json     # 新增独立测试 ✨
```

### 子目录说明文件

**data/dictionary/cngov/README.txt**:

```
CN Government Standard Traditional Chinese Conversion Dictionaries
===================================================================

This directory contains third-party dictionaries for converting traditional
Chinese characters to China's government standard forms.

Files:
  - TGCharacters.txt          Character mappings (~2000 entries)
  - TGCharacters_keep_simp.txt  Variant for mixed documents
  - TGPhrases.txt             Phrase mappings (~7000 entries)
  - GovVariants.txt           Government standard variants (optional)

Author & Copyright:
  Copyright 2024 TerryTian-tech
  https://github.com/TerryTian-tech

Contributors:
  - TerryTian-tech (primary author)
  - Yi Jianpeng (consultant)
  - Hu Xinmei (consultant)
  - Duan Yatong (consultant)

License:
  Apache License 2.0

Reference Standard:
  《通用规范汉字表》(Table of General Standard Chinese Characters)
  Published by State Council of PRC, 2013

Special Notes:
  - TGCharacters.txt lines 1-1635: Traditional → Gov Standard
  - TGCharacters.txt lines 1636+: Simplified → Gov Standard (for mixed docs)
  - Use TGCharacters_keep_simp.txt to preserve intentional simplified chars

Integration:
  Integrated into OpenCC under Apache License 2.0
  OpenCC Copyright 2010-2024 Carbo Kuo <byvoid@byvoid.com>

Last Updated: 2026-01-03
```

---

## 四、整合步骤

### 步骤 1：创建目录结构

```bash
mkdir -p /home/user/OpenCC/data/dictionary/cngov
```

### 步骤 2：下载词典文件

```bash
cd /tmp
BASE_URL="https://raw.githubusercontent.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards/main/t2gov"

# 下载必需文件（跳过 TS 系列）
wget $BASE_URL/TGCharacters.txt
wget $BASE_URL/TGCharacters_keep_simp.txt
wget $BASE_URL/TGPhrases.txt
# wget $BASE_URL/GovVariants.txt  # 可选
```

### 步骤 3：复制到子目录

```bash
cp TG*.txt /home/user/OpenCC/data/dictionary/cngov/
```

### 步骤 4：创建子目录说明文件

按照第三章的内容创建 `data/dictionary/cngov/README.txt`。

### 步骤 5：创建配置文件

**data/config/t2cngov.json**:

```json
{
  "name": "Traditional Chinese to CN Government Standard",
  "author": "TerryTian-tech",
  "license": "Apache License 2.0",
  "source": "https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards",
  "contributors": ["TerryTian-tech", "Yi Jianpeng", "Hu Xinmei", "Duan Yatong"],
  "reference": "《通用规范汉字表》(2013)",
  "description": "Converts traditional Chinese (from various standards) to China's government standard traditional characters. Includes simplified-to-standard conversion for mixed documents.",

  "segmentation": {
    "type": "mmseg",
    "dict": {
      "type": "ocd2",
      "file": "cngov/TGPhrases.ocd2"
    }
  },
  "conversion_chain": [{
    "dict": {
      "type": "group",
      "dicts": [{
        "type": "ocd2",
        "file": "cngov/TGPhrases.ocd2"
      }, {
        "type": "ocd2",
        "file": "cngov/TGCharacters.ocd2"
      }]
    }
  }]
}
```

**data/config/t2cngov_keep_simp.json**:

```json
{
  "name": "Traditional Chinese to CN Government Standard (Keep Simplified)",
  "author": "TerryTian-tech",
  "license": "Apache License 2.0",
  "source": "https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards",
  "contributors": ["TerryTian-tech", "Yi Jianpeng", "Hu Xinmei", "Duan Yatong"],
  "reference": "《通用规范汉字表》(2013)",
  "description": "Conservative conversion that preserves intentional simplified characters in mixed documents while standardizing traditional characters only.",

  "segmentation": {
    "type": "mmseg",
    "dict": {
      "type": "ocd2",
      "file": "cngov/TGPhrases.ocd2"
    }
  },
  "conversion_chain": [{
    "dict": {
      "type": "group",
      "dicts": [{
        "type": "ocd2",
        "file": "cngov/TGPhrases.ocd2"
      }, {
        "type": "ocd2",
        "file": "cngov/TGCharacters_keep_simp.ocd2"
      }]
    }
  }]
}
```

### 步骤 6：修改构建系统

**编辑 `data/CMakeLists.txt`**:

```cmake
# ==============================================================================
# CN Government Standard Conversion Dictionaries (Third-party)
# Copyright 2024 TerryTian-tech
# Source: https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards
# License: Apache License 2.0
# Reference: 《通用规范汉字表》(2013)
# ==============================================================================

# 修改 DICT_DIR 定义（约第 6 行）
set(DICT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/dictionary)
set(DICT_CNGOV_DIR ${CMAKE_CURRENT_SOURCE_DIR}/dictionary/cngov)  # 新增

# 在 DICTS_RAW 列表添加（约第 10-22 行）
set(
  DICTS_RAW
  STCharacters
  STPhrases
  TSCharacters
  TSPhrases
  TWVariants
  TWVariantsRevPhrases
  HKVariants
  HKVariantsRevPhrases
  JPVariants
  JPShinjitaiCharacters
  JPShinjitaiPhrases
)

# 新增 CN Gov 词典列表（单独管理）
set(
  DICTS_CNGOV
  cngov/TGCharacters
  cngov/TGCharacters_keep_simp
  cngov/TGPhrases
)

# 合并所有词典
set(DICTS ${DICTS_RAW} ${DICTS_GENERATED} ${DICTS_CNGOV})

# 为 CNGOV 词典设置输入路径（在 foreach(DICT ${DICTS_RAW}) 之后添加）
foreach(DICT ${DICTS_CNGOV})
  # 去掉 cngov/ 前缀获取文件名
  string(REPLACE "cngov/" "" DICT_BASENAME ${DICT})
  set(DICT_${DICT}_INPUT ${DICT_CNGOV_DIR}/${DICT_BASENAME}.txt)
endforeach(DICT)

# 在 CONFIG_FILES 列表添加（约第 164-179 行）
set(CONFIG_FILES
  config/hk2s.json
  config/hk2t.json
  config/jp2t.json
  config/s2hk.json
  config/s2t.json
  config/s2tw.json
  config/s2twp.json
  config/t2hk.json
  config/t2jp.json
  config/t2s.json
  config/t2tw.json
  config/tw2s.json
  config/tw2sp.json
  config/tw2t.json
  config/t2cngov.json           # 新增
  config/t2cngov_keep_simp.json # 新增
)
```

**⚠️ 重要提示**：上述 CMake 修改比较复杂，需要仔细测试。简化方案见下文"快速验证方案"。

### 步骤 7：更新 README

在 `README.md` 添加转换方案说明（在现有表格中添加）：

```markdown
## Conversion Modes

| Mode | Description |
|------|-------------|
| s2t  | Simplified Chinese to Traditional Chinese |
| t2s  | Traditional Chinese to Simplified Chinese |
| s2tw | Simplified Chinese to Traditional Chinese (Taiwan) |
| tw2s | Traditional Chinese (Taiwan) to Simplified Chinese |
| s2hk | Simplified Chinese to Traditional Chinese (Hong Kong) |
| hk2s | Traditional Chinese (Hong Kong) to Simplified Chinese |
| **t2cngov** | **Traditional Chinese to CN Government Standard** ✨ |
| **t2cngov_keep_simp** | **Keep Simplified in Mixed Documents** ✨ |

### CN Government Standard Mode

```bash
# Convert to government standard (all characters)
echo "測試简体混繁體" | opencc -c t2cngov.json
# Output: 測試簡體混繁體

# Preserve simplified characters
echo "測試简体混繁體" | opencc -c t2cngov_keep_simp.json
# Output: 测试简体混繁體
```

**Credit**: Based on [TerryTian-tech's work](https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards).
```

---

## 五、测试方案

### 快速验证（使用 text 格式）

在修改 CMakeLists.txt 之前，可以先用 text 格式快速验证：

```bash
# 修改配置文件，将所有 "ocd2" 改为 "text"，".ocd2" 改为 ".txt"
# 然后直接测试
echo "潮溼的露臺" | opencc -c data/config/t2cngov.json
```

### 独立测试文件

**test/testcases/cngov_testcases.json**:

```json
{
  "cases": [
    {
      "id": "cngov_001",
      "description": "Basic character conversion",
      "input": "盫",
      "expected": {
        "t2cngov": "盦"
      }
    },
    {
      "id": "cngov_002",
      "description": "Mixed simplified-traditional (convert all)",
      "input": "简体混杂繁體",
      "expected": {
        "t2cngov": "簡體混雜繁體"
      }
    },
    {
      "id": "cngov_003",
      "description": "Mixed simplified-traditional (keep simplified)",
      "input": "简体混杂繁體",
      "expected": {
        "t2cngov_keep_simp": "简体混杂繁體"
      }
    },
    {
      "id": "cngov_004",
      "description": "Variant standardization",
      "input": "潮溼的露臺",
      "expected": {
        "t2cngov": "潮湿的露台",
        "t2cngov_keep_simp": "潮湿的露台"
      }
    },
    {
      "id": "cngov_005",
      "description": "Phrase conversion",
      "input": "一乾二淨",
      "expected": {
        "t2cngov": "一乾二净"
      }
    }
  ]
}
```

### 修改测试代码

**test/CMakeLists.txt** - 添加测试文件复制：

```cmake
set(CONFIG_TEST
  config_test/config_test.json
  config_test/config_test_characters.txt
  config_test/config_test_phrases.txt
  testcases/cngov_testcases.json  # 新增
)
```

**test/CommandLineConvertTest.cpp** - 添加测试函数（在文件末尾，`} // namespace opencc` 之前）：

```cpp
TEST_F(CommandLineConvertTest, ConvertCNGovFromJson) {
#ifdef BAZEL
  const std::string casesPath =
      runfiles_->Rlocation("_main/test/testcases/cngov_testcases.json");
#else
  const std::string casesPath =
      CMAKE_SOURCE_DIR "/test/testcases/cngov_testcases.json";
#endif
  const CasesByConfig cases = LoadCases(casesPath);

  for (const auto& entry : cases) {
    const std::string& config = entry.first;
    const std::string inputFile = InputFile(config.c_str());
    const std::string outputFile = OutputFile(config.c_str());

    {
      std::ofstream ofs(inputFile, std::ios::binary);
      ASSERT_TRUE(ofs.is_open()) << "Failed to open: " << inputFile;
      for (const auto& item : entry.second) {
        ofs << item.input << "\n";
      }
    }

    ASSERT_EQ(0, system(TestCommand(config, inputFile, outputFile).c_str()))
        << "Conversion failed for config: " << config;

    std::ifstream ifs(outputFile, std::ios::binary);
    ASSERT_TRUE(ifs.is_open()) << "Failed to open: " << outputFile;
    std::string line;
    size_t idx = 0;
    while (std::getline(ifs, line)) {
      if (!line.empty() && line.back() == '\r') {
        line.pop_back();
      }
      ASSERT_LT(idx, entry.second.size());
      EXPECT_EQ(entry.second[idx].expected, line)
          << "Mismatch at config=" << config << " index=" << idx
          << " input=\"" << entry.second[idx].input << "\"";
      idx++;
    }
    EXPECT_EQ(idx, entry.second.size()) << "Line count mismatch: " << config;
  }
}
```

---

## 六、验证清单

### 构建验证

```bash
cd /home/user/OpenCC
mkdir -p build && cd build
cmake ..
make -j$(nproc)

# 验证词典编译
ls -lh data/dictionary/cngov/*.ocd2  # 应看到 3 个 ocd2 文件
```

### 功能验证

```bash
# 基础转换
echo "測試繁體轉換" | ./src/tools/opencc -c ../data/config/t2cngov.json

# 简繁混杂（全转繁体）
echo "简体混杂繁體" | ./src/tools/opencc -c ../data/config/t2cngov.json
# 预期输出: 簡體混雜繁體

# 简繁混杂（保留简体）
echo "简体混杂繁體" | ./src/tools/opencc -c ../data/config/t2cngov_keep_simp.json
# 预期输出: 简体混杂繁體

# 异体字标准化
echo "潮溼的露臺" | ./src/tools/opencc -c ../data/config/t2cngov.json
# 预期输出: 潮湿的露台
```

### 测试验证

```bash
cd build
ctest -R CNGov -V
# 或直接运行
./test/CommandLineConvertTest --gtest_filter="*CNGov*"
```

### 完整检查清单

- [ ] `data/dictionary/cngov/` 子目录已创建
- [ ] 词典文件已复制到子目录
- [ ] `cngov/README.txt` 说明文件已创建
- [ ] 配置文件包含完整元数据字段
- [ ] 配置文件使用相对路径（`cngov/*.ocd2`）
- [ ] CMakeLists.txt 已正确修改
- [ ] README.md 已更新（转换方案表 + 致谢）
- [ ] 独立测试文件已创建
- [ ] CMake 构建成功
- [ ] 所有功能测试通过
- [ ] 独立测试通过

---

## 附录：法律合规

### 许可证兼容性

| 项目 | 许可证 | 兼容性 |
|------|--------|--------|
| OpenCC | Apache 2.0 | ✅ |
| TerryTian 项目 | Apache 2.0 | ✅ |
| **整合后** | Apache 2.0 | ✅ 完全兼容 |

### 归属方案

本方案采用**多层归属保护**：

1. **配置文件元数据** - JSON 中的 author/license/source 字段
2. **子目录说明文件** - `cngov/README.txt` 详细归属
3. **CMakeLists.txt 注释** - 构建脚本中的来源说明
4. **Git 提交信息** - 详细的 commit message
5. **README 致谢** - 项目文档中的公开感谢

### Commit Message 模板

```
整合 CN Government Standard 繁体转换模式

采用子目录隔离方案，将第三方词典放入 data/dictionary/cngov/。

新增内容：
- 词典子目录：data/dictionary/cngov/
  - TGCharacters.txt, TGCharacters_keep_simp.txt
  - TGPhrases.txt
  - README.txt（子目录说明）
- 配置：t2cngov.json, t2cngov_keep_simp.json（含元数据）
- 测试：cngov_testcases.json（独立测试文件）

关键特性：
1. 子目录隔离：便于管理和更新第三方内容
2. 配置元数据：JSON 中包含完整版权信息
3. 独立测试：避免上游冲突
4. 相对路径：配置中使用 cngov/*.ocd2

来源仓库：
https://github.com/TerryTian-tech/OpenCC-Traditional-Chinese-characters-according-to-Chinese-government-standards

版权：
  Copyright 2024 TerryTian-tech
  Apache License 2.0

贡献者：
  TerryTian-tech, Yi Jianpeng, Hu Xinmei, Duan Yatong

参考标准：
  《通用规范汉字表》(2013)
```

---

## 常见问题

**Q: 为什么使用子目录而不是直接放在 dictionary/ 下？**

A:
1. 清晰隔离第三方内容，便于识别和管理
2. 方便整体更新（直接替换子目录）
3. 支持未来添加其他第三方词典源
4. 避免与官方词典命名冲突

**Q: 配置文件中的额外字段会影响 OpenCC 运行吗？**

A: 不会。OpenCC 只解析 `name`, `segmentation`, `conversion_chain` 三个字段，其他字段会被安全忽略（已验证源码 Config.cpp:300-316）。

**Q: 子目录中的 .ocd2 文件会被正确编译吗？**

A: 会。CMakeLists.txt 需要正确配置路径。词典编译后会输出到 `build/data/cngov/*.ocd2`，安装时需确保保留目录结构。

**Q: 如何更新 cngov 词典？**

A:
1. 下载最新的 TG*.txt 文件
2. 替换 `data/dictionary/cngov/` 中的文件
3. 重新运行 `make`
4. Git commit 时注明更新来源和版本

**Q: 可以添加其他第三方词典吗？**

A: 可以。参考本方案创建新的子目录（如 `data/dictionary/other_project/`），并在配置文件中使用相对路径引用。

---

**文档版本**: 3.0 (子目录+元数据方案)
**最后更新**: 2026-01-03
**维护者**: OpenCC Integration Team
**原始作者**: TerryTian-tech
