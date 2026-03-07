# OpenCC Jieba 外掛化架構重設計與執行方案

> 目標：讓 OpenCC 不再將 Jieba 靜態編譯進核心，而是於讀到 `"segmentation": {"type": "jieba"}` 時，動態尋找並載入 `libopencc-jieba.so`（或平台對應名稱），以便發行版可拆分成 `opencc` 與 `opencc-jieba` 套件。

## 1. 問題與目標

### 1.1 目前痛點

- Jieba 目前需在編譯期透過 `ENABLE_JIEBA` 決定是否納入，導致：
  - 核心套件與可選分詞能力耦合。
  - 發行版不易做「最小核心 + 可選擴充」打包。
  - 使用者拿到 `jieba` 配置時，若核心未編進 Jieba，僅能得到 `Unknown segmentation type: jieba`。

### 1.2 重設計目標

- 核心（`libopencc`）維持「分詞介面 + 轉換鏈」能力，不含 cppjieba 直接依賴。
- Jieba 由獨立外掛（建議 `libopencc-jieba.so`）提供，採動態載入。
- 配置層面保持相容：既有 `type = "jieba"` 配置可直接使用。
- 發行版可拆包：
  - `opencc`：核心 + mmseg
  - `opencc-jieba`：Jieba 外掛 + Jieba 字典

---

## 2. 新架構概觀

```
+------------------------+
|      應用程式/API      |
+-----------+------------+
            |
            v
+------------------------+
|       libopencc        |
|  - Config Parser       |
|  - SegmentationFactory |
|  - PluginManager       |
+-----------+------------+
            |
   dlopen/dlsym (POSIX)
            |
            v
+------------------------+        +---------------------------+
|  libopencc-jieba.so    | -----> | cppjieba + jieba_dict     |
|  - plugin entrypoint   |        | (由 opencc-jieba 套件提供) |
|  - JiebaSegmentation   |        +---------------------------+
+------------------------+
```

核心只負責：
1. 解析配置辨識 `segmentation.type`。
2. 對未知（或非內建）分詞器，走外掛解析流程。
3. 驗證外掛 API 版本並建立 `Segmentation` 實例。

---

## 3. 核心介面設計（ABI/API）

為兼顧 C++ 內部物件與動態載入穩定性，建議採 **C ABI + 函式表**。

### 3.1 Plugin Descriptor（C ABI）

新增（示意）標頭：`src/plugin/OpenCCPlugin.h`

```c
#define OPENCC_PLUGIN_ABI_VERSION 1

typedef struct {
  const char* key;   // 例如 "dict_path"
  const char* value; // UTF-8
} opencc_kv_pair_t;

typedef struct opencc_segmentation_handle opencc_segmentation_handle_t;

typedef struct {
  uint32_t abi_version;
  const char* plugin_name;           // "opencc-jieba"
  const char* segmentation_type;     // "jieba"

  // 建立分詞器實例；config 來自 segmentation 區塊
  int (*create)(const opencc_kv_pair_t* config,
                size_t config_size,
                opencc_segmentation_handle_t** out,
                char** err_msg);

  // 執行分詞，回傳 UTF-8 token 陣列
  int (*segment)(opencc_segmentation_handle_t* h,
                 const char* utf8_text,
                 char*** tokens,
                 size_t* token_count,
                 char** err_msg);

  void (*free_tokens)(char** tokens, size_t token_count);
  void (*destroy)(opencc_segmentation_handle_t* h);
  void (*free_error)(char* err_msg);
} opencc_segmentation_plugin_v1;

// 外掛必須導出此符號
const opencc_segmentation_plugin_v1* opencc_get_segmentation_plugin_v1(void);
```

### 3.2 核心端 C++ 包裝

- 在核心新增 `PluginSegmentationAdapter : public Segmentation`。
- `Segment()` 內部呼叫 plugin `segment()`，再轉成 `Segments`。
- 由 `PluginManager` 管理 `.so` 生命週期（`dlopen` handle、descriptor 快取、銷毀順序）。

### 3.3 錯誤語意

- 外掛錯誤統一映射為 OpenCC 例外（如 `RuntimeError` / `InvalidFormat`）。
- `err_msg` 由外掛配置 allocator，核心透過 `free_error()` 釋放，避免跨 CRT 釋放問題。

---

## 4. 配置與載入策略

### 4.1 配置相容

`type = "jieba"` 維持不變：

```json
"segmentation": {
  "type": "jieba",
  "dict_path": "jieba_dict/jieba.dict.utf8",
  "model_path": "jieba_dict/hmm_model.utf8",
  "user_dict_path": "jieba_dict/user.dict.utf8"
}
```

### 4.2 外掛搜尋順序（建議）

當 `type = "jieba"`：

1. 明確環境變數：`OPENCC_SEGMENTATION_PLUGIN_PATH`（可含多路徑）。
2. 編譯期預設路徑（如 `${libdir}/opencc/plugins`）。
3. 同目錄回退：`libopencc` 所在目錄。
4. 系統 linker 預設路徑。

檔名規則：
- Linux: `libopencc-jieba.so`
- macOS: `libopencc-jieba.dylib`
- Windows: `opencc-jieba.dll`

### 4.3 安全與可控性

- 可加入 `OPENCC_DISABLE_PLUGINS=1` 供高安全場景停用動態載入。
- 僅接受檔名白名單（Linux/macOS：`libopencc-*.so` / `libopencc-*.dylib`，Windows：`opencc-*.dll`）以降低任意動態庫注入風險。
- 驗證 `abi_version`，不符立即拒載。

---

## 5. 建置與打包重構

## 5.1 CMake（建議）

新增選項：
- `ENABLE_SEGMENTATION_PLUGINS`（預設 ON）
- `BUILD_OPENCC_JIEBA_PLUGIN`（預設 OFF，可由發行版啟用）

目標拆分：
- `opencc` 核心：不連結 cppjieba
- `opencc-jieba` 外掛：連結 cppjieba，輸出到 plugin 目錄

## 5.2 Bazel（建議）

- 增加 `cc_binary(..., linkshared = True)` 產生 `libopencc-jieba.so`。
- 將 `//deps/libcppjieba` 與 `//data/jieba_dict` 移至外掛打包規則。

## 5.3 發行版打包

- `opencc`：
  - `libopencc.so`
  - 內建 config（不含 jieba 亦可，或保留並於缺 plugin 時報明確錯）
- `opencc-jieba`：
  - `libopencc-jieba.so`
  - `jieba_dict/*`
  - 可選：`s2twp_jieba.json` / `tw2sp_jieba.json`

## 5.4 Windows 平台與 WinGet 生態（重點補充）

### 5.4.1 Windows 動態載入實作

- 以 `LoadLibraryExW` + `GetProcAddress` 實作 `SharedLibrary`，避免在 Windows 分支額外分散邏輯。
- 優先使用 `LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR`（或等價策略），降低 DLL Hijacking 風險。
- 可在初始化階段呼叫 `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)`（若可行）統一搜尋行為。

### 5.4.2 Windows 安裝路徑建議

- `opencc` 套件（核心）：
  - `opencc.dll` / `opencc.exe`
  - `%ProgramFiles%\OpenCC\bin`
- `opencc-jieba` 套件（外掛）：
  - `opencc-jieba.dll`
  - `%ProgramFiles%\OpenCC\plugins`
  - `%ProgramFiles%\OpenCC\share\opencc\jieba_dict\*`
- 核心預設外掛搜尋路徑可加入 `%ProgramFiles%\OpenCC\plugins`，並允許以 `OPENCC_SEGMENTATION_PLUGIN_PATH` 覆蓋。

### 5.4.3 WinGet 打包建議

- 建議拆成兩個 package ID：
  - `OpenCC.OpenCC`（核心）
  - `OpenCC.OpenCC.Jieba`（外掛）
- `OpenCC.OpenCC.Jieba` manifest 可宣告對 `OpenCC.OpenCC` 的相依，確保安裝順序。
- `winget install OpenCC.OpenCC`：預設最小安裝（不含 Jieba）。
- `winget install OpenCC.OpenCC.Jieba`：補齊 Jieba plugin 與字典。
- 若使用者嘗試 `jieba` 配置但缺外掛，錯誤訊息應明確提示：`Please install package OpenCC.OpenCC.Jieba (winget install OpenCC.OpenCC.Jieba)`。

### 5.4.4 Windows CI / 驗證

- 在 Windows runner 建立兩組測試：
  1. 僅安裝核心（確認 `jieba` 配置報錯且訊息可行動）。
  2. 安裝核心 + 外掛（確認 `s2twp_jieba.json` 正常）。
- 增加一個 DLL 搜尋路徑安全測試：確認不會從 CWD 誤載未知同名 DLL。

---

## 6. 相容性策略

### 6.1 向後相容

- 若系統未安裝 plugin：
  - 錯誤訊息改為可行動建議，例如：
    - `Segmentation plugin 'jieba' not found. Please install package 'opencc-jieba'.`
- 若有 plugin 且 ABI 相容：既有配置直接可用。

### 6.2 漸進式遷移

- 第一階段可保留 `ENABLE_JIEBA`（舊路徑）與 plugin（新路徑）並存。
- 第二階段 deprecate 靜態編譯路徑，CI 改以 plugin 為主。
- 第三階段移除核心直連 cppjieba。

---

## 7. 測試與驗證方案

### 7.1 單元測試

- `PluginManagerTest`
  - 找不到檔案
  - 缺符號 `opencc_get_segmentation_plugin_v1`
  - ABI mismatch
- `PluginSegmentationAdapterTest`
  - token 回傳正確
  - 外掛錯誤傳遞

### 7.2 整合測試

- 有安裝 `opencc-jieba`：`s2twp_jieba.json` 轉換成功。
- 無安裝 `opencc-jieba`：得到預期錯誤字串（含安裝建議）。

### 7.3 打包測試（發行版關鍵）

- 僅安裝 `opencc`：一般 mmseg 配置可用，jieba 配置失敗但錯誤可理解。
- 安裝 `opencc + opencc-jieba`：jieba 配置恢復正常。

---

## 8. 實作里程碑（可直接排期）

### M1：核心 plugin 基礎設施（1~2 週）

- 定義 C ABI 與 `PluginManager`。
- `Config` 在 `type != mmseg` 時可嘗試 plugin 解析。
- 加入基本錯誤訊息與路徑搜尋。

### M2：Jieba 外掛實作（1 週）

- 將現有 `JiebaSegmentation` 邏輯遷入外掛。
- 完成 `libopencc-jieba` 產物與安裝路徑。

### M3：測試與 CI（1 週）

- 新增 plugin 模式單元/整合測試。
- CI matrix：
  - 核心 only
  - 核心 + jieba plugin

### M4：文件與發行版指南（0.5 週）

- 更新 `JIEBA_USAGE.md`：從「編譯期功能」改為「可選插件」。
- 新增 distro 打包建議（Deb/RPM/Homebrew/Nix）。

---

## 9. 風險與對策

- **ABI 穩定性風險**：以版本化函式表（v1/v2）演進，避免破壞舊 plugin。
- **跨平台動態載入差異**：封裝一層 `SharedLibrary` 抽象（dlopen/LoadLibrary）。
- **效能疑慮**：plugin 載入只在初始化發生一次；分詞時透過函式指標呼叫，額外開銷可忽略。
- **除錯成本**：強化啟動日誌（可選 debug env）與明確錯誤碼。

---

## 10. 建議最終落地形式

- OpenCC 主倉：
  - 提供 plugin host 能力 + 官方 `opencc-jieba` plugin 原始碼。
- 套件管理層：
  - 預設安裝 `opencc`。
  - 使用者需要 `jieba` 時再安裝 `opencc-jieba`。

這樣可以同時達成：
1. 核心精簡。
2. 發行版可選依賴。
3. 使用者配置體驗不變（仍然 `type: "jieba"`）。
