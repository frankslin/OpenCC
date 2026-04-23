#include <string>
#include <memory>
#include <unordered_map>

#include <emscripten/emscripten.h>
#ifdef OPENCC_WASM_WITH_OPENCC
#include "../src/opencc.h"
#include "../src/ConversionInspection.hpp"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/writer.h"
#endif

struct Converter {
  std::unique_ptr<opencc::SimpleConverter> simple;
  std::string out;
  std::string inspect_json;
};

static std::unordered_map<int, Converter> converters;
static int next_id = 1;

static const char* throw_error(const char* msg) {
  emscripten_throw_string(msg);
  return msg;
}

extern "C" {

int opencc_create(const char* configPath) {
#ifdef OPENCC_WASM_WITH_OPENCC
  if (configPath == nullptr) {
    throw_error("opencc_create: null configPath");
    return -1;
  }
  try {
    std::unique_ptr<opencc::SimpleConverter> simple(
        new opencc::SimpleConverter(configPath));
    int id = next_id++;
    converters.emplace(
        id, Converter{std::move(simple), std::string(), std::string()});
    return id;
  } catch (const std::exception& ex) {
    throw_error(ex.what());
    return -1;
  }
#else
  (void)configPath;
  throw_error("opencc_create: OPENCC_WASM_WITH_OPENCC not enabled");
  return -1;
#endif
}

const char* opencc_convert(int handle, const char* input) {
#ifdef OPENCC_WASM_WITH_OPENCC
  if (input == nullptr) {
    return throw_error("opencc_convert: null input");
  }
  auto it = converters.find(handle);
  if (it == converters.end()) {
    return throw_error("opencc_convert: invalid handle");
  }
  try {
    it->second.out = it->second.simple->Convert(input);
    return it->second.out.c_str();
  } catch (const std::exception& ex) {
    return throw_error(ex.what());
  }
#else
  (void)handle;
  (void)input;
  return throw_error("opencc_convert: OPENCC_WASM_WITH_OPENCC not enabled");
#endif
}

const char* opencc_inspect(int handle, const char* input) {
#ifdef OPENCC_WASM_WITH_OPENCC
  if (input == nullptr) {
    return throw_error("opencc_inspect: null input");
  }
  auto it = converters.find(handle);
  if (it == converters.end()) {
    return throw_error("opencc_inspect: invalid handle");
  }
  try {
    const opencc::ConversionInspectionResult result =
        it->second.simple->Inspect(input);
    rapidjson::StringBuffer buffer;
    rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
    writer.StartObject();
    writer.Key("input");
    writer.String(result.input.data(),
                  static_cast<rapidjson::SizeType>(result.input.size()));
    writer.Key("segments");
    writer.StartArray();
    for (const auto& segment : result.segments) {
      writer.String(segment.data(),
                    static_cast<rapidjson::SizeType>(segment.size()));
    }
    writer.EndArray();
    writer.Key("stages");
    writer.StartArray();
    for (const auto& stage : result.stages) {
      writer.StartObject();
      writer.Key("index");
      writer.Uint64(stage.index);
      writer.Key("segments");
      writer.StartArray();
      for (const auto& segment : stage.segments) {
        writer.String(segment.data(),
                      static_cast<rapidjson::SizeType>(segment.size()));
      }
      writer.EndArray();
      writer.EndObject();
    }
    writer.EndArray();
    writer.Key("output");
    writer.String(result.output.data(),
                  static_cast<rapidjson::SizeType>(result.output.size()));
    writer.EndObject();
    it->second.inspect_json.assign(buffer.GetString(), buffer.GetSize());
    return it->second.inspect_json.c_str();
  } catch (const std::exception& ex) {
    return throw_error(ex.what());
  }
#else
  (void)handle;
  (void)input;
  return throw_error("opencc_inspect: OPENCC_WASM_WITH_OPENCC not enabled");
#endif
}

void opencc_destroy(int handle) {
#ifdef OPENCC_WASM_WITH_OPENCC
  auto it = converters.find(handle);
  if (it != converters.end()) {
    converters.erase(it);
  }
#else
  (void)handle;
#endif
}

}  // extern "C"
