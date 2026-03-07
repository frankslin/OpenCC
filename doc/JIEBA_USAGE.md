# 使用 Jieba 分词（实验性功能）

本文档说明如何在 OpenCC 中启用和使用 Jieba 中文分词功能。

> 架構重設計提案（Jieba 外掛化）請見：`doc/JIEBA_PLUGIN_ARCHITECTURE_PLAN.md`。

## 概述

OpenCC 默认使用最大正向匹配（mmseg）算法进行分词。从版本 X.X.X 开始，我们引入了对 **Jieba 分词**的实验性支持。

### Jieba 分词的优势

- **智能分词**：结合词典、动态规划和 HMM 模型，更准确地识别词语边界
- **未登录词识别**：通过 HMM 模型自动识别词典中不存在的新词、人名、地名等
- **灵活性**：支持自定义用户词典，适应特定领域的分词需求

### 适用场景

- 处理包含大量网络新词、专有名词的现代文本
- 需要更精确的语义理解的转换场景
- 对分词准确性要求较高的应用

---

## 编译配置

Jieba 分词支持是**可选的**，默认不启用。要使用此功能，需要在编译时启用：

### 使用 CMake

```bash
mkdir build && cd build
cmake -DENABLE_JIEBA=ON ..
make
sudo make install
```

### 验证编译

编译成功后，库将包含 Jieba 分词功能。您可以通过尝试加载 jieba 配置文件来验证。

---

## 配置文件

### 基本结构

使用 Jieba 分词的配置文件格式如下：

```json
{
  "name": "配置名称",
  "segmentation": {
    "type": "jieba",
    "dict_path": "jieba_dict/jieba.dict.utf8",
    "model_path": "jieba_dict/hmm_model.utf8",
    "user_dict_path": "jieba_dict/user.dict.utf8"
  },
  "conversion_chain": [
    {
      "dict": {
        "type": "ocd2",
        "file": "STPhrases.ocd2"
      }
    }
  ]
}
```

### 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| `type` | 是 | 必须设置为 `"jieba"` |
| `dict_path` | 是 | Jieba 主词典文件路径 |
| `model_path` | 是 | HMM 模型文件路径 |
| `user_dict_path` | 否 | 用户自定义词典路径（可选） |

### 示例配置

项目提供了两个示例配置文件：

- **`data/config/s2twp_jieba.json`** - 简体转台湾繁体（含短语，使用 Jieba 分词）
- **`data/config/tw2sp_jieba.json`** - 台湾繁体转简体（含短语，使用 Jieba 分词）

---

## 使用方法

### C++ API

```cpp
#include "opencc.h"

int main() {
  // 使用 jieba 配置文件初始化转换器
  opencc_t converter = opencc_open("s2twp_jieba.json");

  if (converter == (opencc_t)-1) {
    // 错误处理
    return 1;
  }

  const char* input = "我来到北京清华大学学习自然语言处理";
  char* output = opencc_convert_utf8(converter, input, -1);

  printf("%s\n", output);

  opencc_convert_utf8_free(output);
  opencc_close(converter);
  return 0;
}
```

### 命令行工具

```bash
# 使用 jieba 配置进行转换
echo "我来到北京清华大学" | opencc -c s2twp_jieba.json

# 或者处理文件
opencc -c s2twp_jieba.json -i input.txt -o output.txt
```

### Python 绑定

```python
import opencc

# 使用 jieba 配置
converter = opencc.OpenCC('s2twp_jieba.json')
result = converter.convert('我来到北京清华大学')
print(result)
```

---

## 自定义用户词典

用户词典允许您添加特定领域的词语，确保这些词不会被错误拆分。

### 词典格式

文件：`data/jieba_dict/user.dict.utf8`

格式：每行一个词语，可选词频和词性

```
词语 词频 词性
```

### 示例

```
云计算 5 n
机器学习 8 n
深度学习 10 n
OpenCC 3 n
简繁转换 4 v
```

### 使用自定义词典

1. 编辑 `data/jieba_dict/user.dict.utf8`
2. 在配置文件中指定路径：

```json
{
  "segmentation": {
    "type": "jieba",
    "dict_path": "jieba_dict/jieba.dict.utf8",
    "model_path": "jieba_dict/hmm_model.utf8",
    "user_dict_path": "jieba_dict/user.dict.utf8"
  }
}
```

---

## 性能考虑

### 初始化时间

- Jieba 分词器在首次加载时需要读取词典和 HMM 模型
- 典型初始化时间：50-100ms（取决于硬件）
- **建议**：复用转换器实例，避免重复初始化

### 运行时性能

- Jieba 分词比 mmseg 稍慢（约 10-30% 开销）
- 但提供了显著更好的分词准确性
- 对于大多数应用场景，性能差异可忽略

### 内存占用

- Jieba 词典约占用 20-30MB 内存
- 建议在内存受限环境中评估后使用

---

## 对比：mmseg vs Jieba

| 特性 | mmseg | Jieba |
|------|-------|-------|
| **算法** | 最大正向匹配 | 词典 + 动态规划 + HMM |
| **准确性** | 基础 | 高 |
| **未登录词** | 不支持 | 支持（HMM） |
| **性能** | 快 | 稍慢（~10-30%） |
| **内存占用** | 低 | 中等（~20MB） |
| **自定义词典** | 通过 OpenCC 词典 | 支持 user.dict |

### 何时使用 Jieba？

**推荐使用 Jieba**：
- 处理现代文本（社交媒体、新闻等）
- 需要识别专有名词和新词
- 对分词准确性要求高

**继续使用 mmseg**：
- 追求最快速度
- 内存受限环境
- 已有完善的 OpenCC 自定义词典

---

## 故障排除

### 错误：找不到词典文件

**症状**：
```
Error: FileNotFound: jieba_dict/jieba.dict.utf8
```

**解决方案**：
1. 确认词典文件已复制到 `data/jieba_dict/` 目录
2. 检查配置文件中的路径是否正确
3. 确保路径相对于 OpenCC 数据目录

### 错误：Unknown segmentation type: jieba

**症状**：
```
Error: Unknown segmentation type: jieba
```

**解决方案**：
- 确认编译时启用了 `-DENABLE_JIEBA=ON`
- 重新编译并安装 OpenCC

### 分词结果不符合预期

**解决方案**：
1. 检查用户词典是否正确配置
2. 验证输入文本编码为 UTF-8
3. 考虑调整用户词典添加特定词语

---

## 限制与注意事项

1. **实验性功能**：Jieba 分词支持仍在开发中，API 可能变化
2. **兼容性**：需要编译时启用，不向后兼容旧版本
3. **词典依赖**：依赖外部 jieba 词典文件
4. **语言支持**：主要针对简体和繁体中文优化

---

## 参考资料

- [Jieba 分词原理](../doc/JIEBA_SEGMENTATION_FEASIBILITY.md)
- [cppjieba GitHub](https://github.com/yanyiwu/cppjieba)
- [OpenCC 配置文件规范](./CONFIGURATION.md)

---

## 反馈与贡献

如果您在使用 Jieba 分词时遇到问题或有改进建议，请：

1. 在 [GitHub Issues](https://github.com/BYVoid/OpenCC/issues) 提交问题
2. 标注 `jieba` 标签
3. 提供配置文件和示例文本

欢迎贡献代码改进 Jieba 分词集成！
