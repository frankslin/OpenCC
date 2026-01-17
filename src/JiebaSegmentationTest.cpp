/*
 * Open Chinese Convert
 *
 * Copyright 2015 Carbo Kuo <byvoid@byvoid.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "JiebaSegmentation.hpp"
#include "Segments.hpp"
#include "TestUtils.hpp"
#include "TestUtilsUTF8.hpp"

#include <fstream>
#include <memory>
#include <sstream>

#ifdef BAZEL
#include "tools/cpp/runfiles/runfiles.h"
using bazel::tools::cpp::runfiles::Runfiles;
#endif

#include "rapidjson/document.h"

namespace opencc {

class JiebaSegmentationTest : public ::testing::Test {
protected:
  virtual void SetUp() {
#ifdef BAZEL
    runfiles_.reset(Runfiles::CreateForTest());
    ASSERT_NE(nullptr, runfiles_);
    dictPath = runfiles_->Rlocation("_main/data/jieba_dict/jieba.dict.utf8");
    modelPath = runfiles_->Rlocation("_main/data/jieba_dict/hmm_model.utf8");
    userDictPath = runfiles_->Rlocation("_main/data/jieba_dict/user.dict.utf8");
#else
    dictPath = CMAKE_SOURCE_DIR "/data/jieba_dict/jieba.dict.utf8";
    modelPath = CMAKE_SOURCE_DIR "/data/jieba_dict/hmm_model.utf8";
    userDictPath = CMAKE_SOURCE_DIR "/data/jieba_dict/user.dict.utf8";
#endif
    segmenter = SegmentationPtr(
        new JiebaSegmentation(dictPath, modelPath, userDictPath));

#ifdef BAZEL
    testcasesPath_ = runfiles_->Rlocation(
        "_main/test/testcases/jieba_comparison_testcases.json");
#else
    testcasesPath_ =
        CMAKE_SOURCE_DIR "/test/testcases/jieba_comparison_testcases.json";
#endif
  }

#ifdef BAZEL
  std::unique_ptr<Runfiles> runfiles_;
#endif
  std::string dictPath;
  std::string modelPath;
  std::string userDictPath;
  SegmentationPtr segmenter;
  std::string testcasesPath_;
};

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

TEST_F(JiebaSegmentationTest, RunAllTestCases) {
  std::ifstream ifs(testcasesPath_);
  ASSERT_TRUE(ifs.is_open()) << "Failed to open: " << testcasesPath_;
  std::stringstream buffer;
  buffer << ifs.rdbuf();
  std::string json = buffer.str();

  rapidjson::Document doc;
  doc.Parse(json.c_str());
  ASSERT_FALSE(doc.HasParseError());
  ASSERT_TRUE(doc.IsObject());
  ASSERT_TRUE(doc.HasMember("cases"));
  const auto& cases = doc["cases"];
  ASSERT_TRUE(cases.IsArray());

  for (auto& testcase : cases.GetArray()) {
    ASSERT_TRUE(testcase.IsObject());
    ASSERT_TRUE(testcase.HasMember("input"));
    ASSERT_TRUE(testcase["input"].IsString());
    const std::string input = testcase["input"].GetString();
    const std::string id =
        testcase.HasMember("id") && testcase["id"].IsString()
            ? testcase["id"].GetString()
            : "(unknown id)";
    ASSERT_TRUE(testcase.HasMember("expected_segmentation"));
    ASSERT_TRUE(testcase["expected_segmentation"].IsString());
    const std::string expectedSegmentation =
        testcase["expected_segmentation"].GetString();

    const auto& segments = segmenter->Segment(input);
    std::string joined = JoinSegments(segments);
    EXPECT_EQ(expectedSegmentation, joined) << "case=" << id;
  }
}

} // namespace opencc
