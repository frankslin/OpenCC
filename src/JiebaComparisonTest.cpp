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
#include "Segments.hpp"
#include "SimpleConverter.hpp"
#include "TestUtils.hpp"
#include "TestUtilsUTF8.hpp"

#include <fstream>
#include <iomanip>
#include <memory>
#include <sstream>
#include <unordered_map>

#include "rapidjson/document.h"

#ifdef BAZEL
#include "tools/cpp/runfiles/runfiles.h"
using bazel::tools::cpp::runfiles::Runfiles;
#endif

#ifdef ENABLE_JIEBA
#include "JiebaSegmentation.hpp"
#endif

namespace opencc {

namespace {
std::string ParentDir(const std::string& path) {
  std::string::size_type pos = path.find_last_of("/\\");
  if (pos == std::string::npos) {
    return "";
  }
  return path.substr(0, pos);
}
} // namespace

/**
 * Test fixture for comparing segmentation algorithms using JSON test cases.
 */
class JiebaComparisonTest : public ::testing::Test {
protected:
  void SetUp() override {
#ifdef ENABLE_JIEBA
#ifdef BAZEL
    runfiles_.reset(Runfiles::CreateForTest());
    ASSERT_NE(nullptr, runfiles_);
    testcasesPath_ = runfiles_->Rlocation(
        "_main/test/testcases/jieba_comparison_testcases.json");
    configDir_ = runfiles_->Rlocation("_main/data/config");
    dictDir_ = runfiles_->Rlocation("_main/data/dictionary");
    jiebaDir_ = runfiles_->Rlocation("_main/data/jieba_dict");
#else
    testcasesPath_ =
        CMAKE_SOURCE_DIR "/test/testcases/jieba_comparison_testcases.json";
    configDir_ = CMAKE_SOURCE_DIR "/data/config";
    dictDir_ = CMAKE_SOURCE_DIR "/data/dictionary";
    jiebaDir_ = CMAKE_SOURCE_DIR "/data/jieba_dict";
#endif
    dataDir_ = ParentDir(configDir_);
    runfilesRoot_ = ParentDir(dataDir_);
    // Load test cases from JSON
    std::ifstream ifs(testcasesPath_);
    ASSERT_TRUE(ifs.is_open()) << "Failed to open: " << testcasesPath_;

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
        jiebaDir_ + "/jieba.dict.utf8",
        jiebaDir_ + "/hmm_model.utf8",
        jiebaDir_ + "/user.dict.utf8"));
#else
    GTEST_SKIP() << "Jieba segmentation not enabled (compile with -DENABLE_JIEBA=ON)";
#endif
  }

  SimpleConverter& GetConverter(const std::string& config) {
    auto it = converters_.find(config);
    if (it != converters_.end()) {
      return *it->second;
    }
    const std::string configPath = configDir_ + "/" + config + ".json";
    auto inserted = converters_.emplace(
        config,
        std::make_unique<SimpleConverter>(
            configPath,
            std::vector<std::string>{
                configDir_, dictDir_, dataDir_, runfilesRoot_}));
    return *inserted.first->second;
  }

  std::string JoinSegments(const SegmentsPtr& segments) {
    std::string result;
    for (size_t i = 0; i < segments->Length(); i++) {
      if (i > 0) {
        result += "/";
      }
      result += segments->At(i);
    }
    return result;
  }

  void CompareOutputs(const std::string& input,
                      const std::string& expectedSegmentation,
                      const rapidjson::Value& expected,
                      const std::string& testId) {
    std::cout << "\n=== Test: " << testId << " ===" << std::endl;
    std::cout << "Input:          " << input << std::endl;

    // Show Jieba segmentation result
    SegmentsPtr segments = jiebaSegmenter_->Segment(input);
    std::string jiebaSegs = JoinSegments(segments);
    std::cout << "Jieba segments: " << jiebaSegs << std::endl;

    if (!expectedSegmentation.empty()) {
      std::cout << "Expected segs:  " << expectedSegmentation << std::endl;
    }

    // Test each config pair (e.g., s2twp vs s2twp_jieba)
    for (auto itr = expected.MemberBegin(); itr != expected.MemberEnd(); ++itr) {
      const std::string config = itr->name.GetString();
      ASSERT_TRUE(itr->value.IsString());
      const std::string expectedOutput = itr->value.GetString();
      SimpleConverter& converter = GetConverter(config);
      std::string output = converter.Convert(input);

      std::cout << std::setw(15) << std::left << (config + ":") << output << std::endl;

      EXPECT_EQ(expectedOutput, output)
          << "config=" << config << " case=" << testId;
    }
  }

  rapidjson::Document doc_;
  std::unordered_map<std::string, std::unique_ptr<SimpleConverter>> converters_;
#ifdef BAZEL
  std::unique_ptr<Runfiles> runfiles_;
#endif
  std::string testcasesPath_;
  std::string configDir_;
  std::string dictDir_;
  std::string jiebaDir_;
  std::string dataDir_;
  std::string runfilesRoot_;
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

    ASSERT_TRUE(testcase.HasMember("expected"));
    const auto& expected = testcase["expected"];
    ASSERT_TRUE(expected.IsObject());

    CompareOutputs(input, expectedSegmentation, expected, id);
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
