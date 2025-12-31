#include <string>

// 简单示例：返回静态字符串，确认 WASM 加载正常。
extern "C" {
const char* hello() {
  static std::string msg = "Hello from OpenCC WASM stub";
  return msg.c_str();
}
}

