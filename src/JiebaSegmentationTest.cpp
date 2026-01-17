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
#include "TestUtils.hpp"

namespace opencc {

class JiebaSegmentationTest : public ::testing::Test {
protected:
  JiebaSegmentationTest()
      : dictPath(CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/jieba.dict.utf8"),
        modelPath(CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/hmm_model.utf8"),
        userDictPath(CMAKE_SOURCE_DIR "/deps/libcppjieba/dict/user.dict.utf8") {
  }

  virtual void SetUp() {
    segmenter = SegmentationPtr(
        new JiebaSegmentation(dictPath, modelPath, userDictPath));
  }

  std::string dictPath;
  std::string modelPath;
  std::string userDictPath;
  SegmentationPtr segmenter;
};

TEST_F(JiebaSegmentationTest, BasicSegmentation) {
  // Test basic Chinese segmentation
  const auto& segments = segmenter->Segment(utf8("我来到北京清华大学"));
  // Jieba should segment this as: 我/来到/北京/清华大学
  EXPECT_GT(segments->Length(), 0);

  // Verify we get at least some segments
  std::string result = segments->ToString();
  EXPECT_EQ(utf8("我来到北京清华大学"), result);
}

TEST_F(JiebaSegmentationTest, ComplexPhrase) {
  // Test with a more complex phrase
  const auto& segments = segmenter->Segment(
      utf8("小明硕士毕业于中国科学院计算所，后在日本京都大学深造"));
  EXPECT_GT(segments->Length(), 0);

  // The result should preserve the original text
  std::string result = segments->ToString();
  EXPECT_EQ(utf8("小明硕士毕业于中国科学院计算所，后在日本京都大学深造"),
            result);
}

TEST_F(JiebaSegmentationTest, EmptyString) {
  const auto& segments = segmenter->Segment("");
  EXPECT_EQ(0, segments->Length());
}

TEST_F(JiebaSegmentationTest, SingleCharacter) {
  const auto& segments = segmenter->Segment(utf8("我"));
  EXPECT_EQ(1, segments->Length());
  EXPECT_EQ(utf8("我"), std::string(segments->At(0)));
}

TEST_F(JiebaSegmentationTest, EnglishAndChinese) {
  // Test mixed English and Chinese
  const auto& segments = segmenter->Segment(utf8("我爱Python编程"));
  EXPECT_GT(segments->Length(), 0);

  std::string result = segments->ToString();
  EXPECT_EQ(utf8("我爱Python编程"), result);
}

TEST_F(JiebaSegmentationTest, UnknownWords) {
  // Test with some unknown/new words that may not be in dictionary
  // Jieba's HMM should handle these
  const auto& segments = segmenter->Segment(utf8("蓝翔技校挖掘机专业"));
  EXPECT_GT(segments->Length(), 0);

  std::string result = segments->ToString();
  EXPECT_EQ(utf8("蓝翔技校挖掘机专业"), result);
}

} // namespace opencc
