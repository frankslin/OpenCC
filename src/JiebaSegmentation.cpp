/*
 * Open Chinese Convert
 *
 * Copyright 2026 Frank Lin <github@linshuang.info>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "JiebaSegmentation.hpp"
#include "Segments.hpp"

// Include CppJieba headers
#include "Application.hpp"

using namespace opencc;

JiebaSegmentation::JiebaSegmentation(const std::string& dictPath,
                                     const std::string& modelPath,
                                     const std::string& userDictPath)
    : jieba_(new CppJieba::Application(
          dictPath,
          modelPath,
          userDictPath.empty() ? "" : userDictPath,
          "",  // idf path (not used for basic segmentation)
          ""   // stop words path (not used for basic segmentation)
      )) {
}

JiebaSegmentation::~JiebaSegmentation() = default;

SegmentsPtr JiebaSegmentation::Segment(const std::string& text) const {
  SegmentsPtr segments(new Segments);
  std::vector<std::string> words;

  // Use MIX method: combination of dictionary matching and HMM
  // This provides the best balance between accuracy and handling unknown words
  jieba_->cut(text, words, CppJieba::METHOD_MIX);

  for (const auto& word : words) {
    segments->AddSegment(word);
  }

  return segments;
}
