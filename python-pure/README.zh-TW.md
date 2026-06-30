# opencc-py (OpenCC 純 Python 實作)

[English version](README.md)

此目錄包含 [OpenCC](https://github.com/BYVoid/OpenCC) 中文轉換演算法的純
Python 實作，提供與 Python package 相同的匯入介面：

```python
import opencc

converter = opencc.OpenCC("s2t")
print(converter.convert("汉字"))  # 漢字
```

## 資料依賴

此 package 不再直接內嵌 OpenCC config 或 dictionary。內建轉換資料會在執行時
從 PyPI package [`opencc-data`](https://pypi.org/project/opencc-data/) 載入。

這能讓 pure Python package 保持精簡，並避免依賴 OpenCC source tree 底下的
生成檔案。converter 會讀取：

- `opencc_data.config_path()` 提供的 config JSON 檔案
- `opencc_data.data_path()` 提供的 dictionary text 檔案
- `opencc_data.test_data_path()` 提供的測試案例

自訂 config 仍然支援。當自訂 config 參照本地 dictionary 路徑，例如
`CustomPhrases.ocd2`，純 Python 實作會在 config 檔案旁尋找對應的
`CustomPhrases.txt`。

## 安裝

PyPI package 名稱是 `opencc-py`。使用者可以透過 pip 安裝：

```bash
python -m pip install opencc-py
```

從此目錄進行本地開發安裝：

```bash
python -m pip install .
```

此 package 的版本會與 `opencc-data` 版本一致，並將相同版本的資料 package
宣告為精確安裝依賴，因此 pip 會自動安裝相容的資料 package。

也可以使用 editable development mode：

```bash
python -m pip install -e .
```

## 支援的 Configs

`opencc.CONFIGS` 由 `opencc-data` 提供的 configs 產生。

```python
import opencc

print(opencc.CONFIGS)
```

標準 mmseg configs 與不需要 segmentation 的 configs 皆受支援。Jieba plugin
configs 不包含在 `opencc-data` 中，因此此 package 不會把它們列為內建 configs。

## 測試

先安裝測試依賴，再從 repository root 執行 pytest：

```bash
python -m pip install -r python-pure/tests/requirements_lock.txt
PYTHONPATH=python-pure python -m pytest python-pure/tests
```

測試會驗證：

- 每個內建 config 都能 import 與初始化
- 轉換結果符合 `opencc-data` 測試案例
- 自訂 config 與本地 dictionary 解析
- 支援 configs 的 golden output 相容性

## OpenCC 1.3.2 功能支援狀況

以下 OpenCC 1.3.2 功能已完整支援：

- **CJK 相容表意文字正規化** — 所有內建 config 均包含正規化前處理步驟，
  在轉換前先將 U+F900–U+FAFF 區塊字元映射至標準碼位。
- **`match_policy: union`** — 使用 `"match_policy": "union"` 的 dictionary
  group 會取所有子 dictionary 中最長的前綴命中。
- **`normalization` config 欄位** — 自訂 config 可加入 `normalization` 陣列，
  在 segmentation 前插入正規化步驟。
- **新 configs** — `s2hkp` 與 `hk2sp`（簡體 ↔ 香港繁體，含詞組轉換）
  透過 `opencc-data` 提供。
- **Tofu-risk dictionary 停用** — 建構 `OpenCC()` 時傳入
  `include_tofu_risk_dictionaries=False` 可停用可能輸出現代字型缺字的 dictionary。
- **JSONC** — config 檔案支援 `//` 行注釋與 `/* */` 區塊注釋；純 Python
  後端在解析 JSON 前會先剝除注釋。
- **Inline dictionary** — 自訂 config 支援 `{"type": "inline", "entries":
  {"key": "value", ...}}` 節點。

## 與官方實作的差異

此 package 刻意只實作純 Python 文字轉換所需的部分。相較於官方 C++ library
與 command-line tools，它省略了幾個較底層的實作細節。官方 Python 實作是 PyPI
上的 [`opencc` package](https://pypi.org/project/opencc/)。

- `.ocd2` / `.ocd` 二進位 dictionary 載入；內建 dictionary 會讀取
  `opencc-data` 提供的 `.txt` 資料
- `opencc_dict`、`opencc_phrase_extract` 等 dictionary 編譯與抽取工具
- C API、shared-library 載入行為，以及 ABI/plugin 相容性保證
- native CLI 行為，包括 streaming I/O、命令列選項完整對齊，以及平台相關路徑處理
- package、runfiles、source-tree 資料搜尋 fallback；內建資料一律來自
  `opencc-data`
- optional plugin configs 或 plugin resources 的自動載入，包括 Jieba plugin 的
  package layout
- marisa-trie、Darts 與 C++ segmentation 實作帶來的效能最佳化

轉換語意仍會對齊 OpenCC 的 config-driven pipeline：mmseg segmentation、
ordered dictionary groups、dictionary 內 longest-prefix matching、conversion
chains、normalization，以及 tofu-risk dictionaries 的可選停用。

## License 與合規

此 package 以 Apache License 2.0 發佈。

此專案屬於 [OpenCC](https://github.com/BYVoid/OpenCC) 的衍生作品。執行時轉換
資料由 PyPI package [`opencc-data`](https://pypi.org/project/opencc-data/)
提供。
