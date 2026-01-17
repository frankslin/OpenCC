/*
 * Open Chinese Convert
 *
 * Comparison test for Jieba segmentation vs mmseg.
 * Tests ambiguous segmentation cases where Jieba's HMM model
 * should provide better results than simple maximum match.
 *
 * Test cases are defined in test/testcases/jieba_comparison_testcases.json
 */

#include "Config.hpp"
#include "SimpleConverter.hpp"
#include "TestUtils.hpp"

#include <fstream>
#include <iomanip>
#include <sstream>
#include <unordered_map>

#include "rapidjson/document.h"

#ifdef ENABLE_JIEBA
#include "JiebaSegmentation.hpp"
#endif

namespace opencc {

/**
 * Test fixture for comparing segmentation algorithms using JSON test cases.
 */
class JiebaComparisonTest : public ::testing::Test {
protected:
  void SetUp() override {
#ifdef ENABLE_JIEBA
    // Load test cases from JSON
    std::string testcasesPath = CMAKE_SOURCE_DIR "/test/testcases/jieba_comparison_testcases.json";
    std::ifstream ifs(testcasesPath);
    ASSERT_TRUE(ifs.is_open()) << "Failed to open: " << testcasesPath;

    std::stringstream buffer;
    buffer << ifs.rdbuf();
    std::string json = buffer.str();

    doc_.Parse(json.c_str());
    ASSERT_FALSE(doc_.HasParseError());
    ASSERT_TRUE(doc_.IsObject());
    ASSERT_TRUE(doc_.HasMember("cases"));
    ASSERT_TRUE(doc_["cases"].IsArray());

    // Initialize Jieba segmenter
    jiebaSegmenter_.reset(new JiebaSegmentation(
        CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/jieba.dict.utf8",
        CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/hmm_model.utf8",
        CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/user.dict.utf8"));
#else
    GTEST_SKIP() << "Jieba segmentation not enabled (compile with -DENABLE_JIEBA=ON)";
#endif
  }

  SimpleConverter& GetConverter(const std::string& config) {
    auto it = converters_.find(config);
    if (it != converters_.end()) {
      return *it->second;
    }
    const std::string configPath = config + ".json";
    auto inserted = converters_.emplace(
        config,
        std::make_unique<SimpleConverter>(configPath));
    return *inserted.first->second;
  }

  void CompareConfigs(const std::string& input,
                      const std::string& expectedSegmentation,
                      const rapidjson::Value& configs,
                      const std::string& testId) {
    std::cout << "\n=== Test: " << testId << " ===" << std::endl;
    std::cout << "Input:          " << input << std::endl;

    // Show Jieba segmentation result
    SegmentsPtr segments = jiebaSegmenter_->Segment(input);
    std::cout << "Jieba segments: ";
    for (size_t i = 0; i < segments->Length(); i++) {
      if (i > 0) std::cout << "/";
      std::cout << segments->At(i);
    }
    std::cout << std::endl;

    if (!expectedSegmentation.empty()) {
      std::cout << "Expected segs:  " << expectedSegmentation << std::endl;
    }

    // Test each config pair (e.g., s2twp vs s2twp_jieba)
    for (auto itr = configs.MemberBegin(); itr != configs.MemberEnd(); ++itr) {
      const std::string config = itr->name.GetString();
      SimpleConverter& converter = GetConverter(config);
      std::string output = converter.Convert(input);

      std::cout << std::setw(15) << std::left << (config + ":") << output << std::endl;

      EXPECT_FALSE(output.empty()) << "Config: " << config;
    }
  }

  rapidjson::Document doc_;
  std::unordered_map<std::string, std::unique_ptr<SimpleConverter>> converters_;
#ifdef ENABLE_JIEBA
  std::unique_ptr<JiebaSegmentation> jiebaSegmenter_;
#endif
};

TEST_F(JiebaComparisonTest, RunAllTestCases) {
  const auto& cases = doc_["cases"];

  for (rapidjson::SizeType i = 0; i < cases.Size(); i++) {
    const auto& testcase = cases[i];
    ASSERT_TRUE(testcase.IsObject());

    ASSERT_TRUE(testcase.HasMember("id"));
    const std::string id = testcase["id"].GetString();

    ASSERT_TRUE(testcase.HasMember("input"));
    const std::string input = testcase["input"].GetString();

    std::string expectedSegmentation;
    if (testcase.HasMember("expected_segmentation") &&
        testcase["expected_segmentation"].IsString()) {
      expectedSegmentation = testcase["expected_segmentation"].GetString();
    }

    ASSERT_TRUE(testcase.HasMember("configs"));
    const auto& configs = testcase["configs"];
    ASSERT_TRUE(configs.IsObject());

    CompareConfigs(input, expectedSegmentation, configs, id);
  }
}

// Individual test cases for specific scenarios
TEST_F(JiebaComparisonTest, AmbiguousCase_ZhaoMing) {
  // Test the classic "着名" ambiguous case
  const std::string input = utf8("生活着名为正敏的少女");

  std::cout << "\n=== Focused Test: 着名 ambiguity ===" << std::endl;
  std::cout << "Input:          " << input << std::endl;

  SegmentsPtr segments = jiebaSegmenter_->Segment(input);
  std::cout << "Jieba segments: ";
  for (size_t i = 0; i < segments->Length(); i++) {
    if (i > 0) std::cout << "/";
    std::cout << segments->At(i);
  }
  std::cout << std::endl;

  SimpleConverter& mmseg = GetConverter("s2twp");
  SimpleConverter& jieba = GetConverter("s2twp_jieba");

  std::string outputMmseg = mmseg.Convert(input);
  std::string outputJieba = jieba.Convert(input);

  std::cout << "mmseg (s2twp):       " << outputMmseg << std::endl;
  std::cout << "jieba (s2twp_jieba): " << outputJieba << std::endl;

  if (outputMmseg != outputJieba) {
    std::cout << ">>> DIFFERENCE DETECTED <<<" << std::endl;
  } else {
    std::cout << "(outputs identical)" << std::endl;
  }
}

TEST_F(JiebaComparisonTest, TraditionalToSimplified_ZhuMing) {
  // Test traditional version: 著名
  const std::string input = utf8("生活著名為正敏的少女");

  std::cout << "\n=== Focused Test: Traditional 著名 ===" << std::endl;
  std::cout << "Input:          " << input << std::endl;

  SegmentsPtr segments = jiebaSegmenter_->Segment(input);
  std::cout << "Jieba segments: ";
  for (size_t i = 0; i < segments->Length(); i++) {
    if (i > 0) std::cout << "/";
    std::cout << segments->At(i);
  }
  std::cout << std::endl;

  SimpleConverter& mmseg = GetConverter("tw2sp");
  SimpleConverter& jieba = GetConverter("tw2sp_jieba");

  std::string outputMmseg = mmseg.Convert(input);
  std::string outputJieba = jieba.Convert(input);

  std::cout << "mmseg (tw2sp):       " << outputMmseg << std::endl;
  std::cout << "jieba (tw2sp_jieba): " << outputJieba << std::endl;

  if (outputMmseg != outputJieba) {
    std::cout << ">>> DIFFERENCE DETECTED <<<" << std::endl;
  } else {
    std::cout << "(outputs identical)" << std::endl;
  }
}

} // namespace opencc
