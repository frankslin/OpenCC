/*
 * Open Chinese Convert
 *
 * Copyright 2026 Frank Lin <github@linshuang.info>
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

#pragma once

#include "Common.hpp"
#include "Segmentation.hpp"

namespace CppJieba {
class Application;
}

namespace opencc {
/**
 * Jieba word segmentation (Experimental)
 * Uses the CppJieba library for intelligent Chinese word segmentation
 * with support for unknown words via HMM model.
 * @ingroup opencc_cpp_api
 */
class OPENCC_EXPORT JiebaSegmentation : public Segmentation {
public:
  /**
   * Constructor
   * @param dictPath Path to jieba dictionary file (jieba.dict.utf8)
   * @param modelPath Path to HMM model file (hmm_model.utf8)
   * @param userDictPath Optional path to user dictionary file
   */
  JiebaSegmentation(const std::string& dictPath,
                    const std::string& modelPath,
                    const std::string& userDictPath = "");

  virtual ~JiebaSegmentation();

  /**
   * Performs word segmentation using Jieba's MIX method
   * (combination of dictionary matching and HMM)
   * @param text Input text to segment
   * @return Segmented text
   */
  virtual SegmentsPtr Segment(const std::string& text) const override;

private:
  // PIMPL pattern to hide CppJieba implementation details
  std::unique_ptr<CppJieba::Application> jieba_;
};

} // namespace opencc
