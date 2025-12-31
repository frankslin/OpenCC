#include <string>

#ifdef OPENCC_WASM_WITH_OPENCC
#include "../src/opencc.h"
#endif

extern "C" const char* convert_text(const char* configPath, const char* input) {
  static std::string out;
#ifdef OPENCC_WASM_WITH_OPENCC
  if (configPath == nullptr || input == nullptr) {
    out = "convert_text: invalid args";
    return out.c_str();
  }
  opencc_t oc = opencc_open(configPath);
  if (oc == (opencc_t)-1) {
    out = "convert_text: opencc_open failed";
    return out.c_str();
  }
  char* converted = opencc_convert_utf8(oc, input, (size_t)-1);
  if (converted != nullptr) {
    out.assign(converted);
    opencc_convert_utf8_free(converted);
  } else {
    out = "convert_text: conversion returned null";
  }
  opencc_close(oc);
  return out.c_str();
#else
  (void)configPath;
  (void)input;
  out = "convert_text: OPENCC_WASM_WITH_OPENCC not enabled";
  return out.c_str();
#endif
}
