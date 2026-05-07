import json
import os
import pytest
import sys
import zipfile

_this_dir = os.path.dirname(os.path.abspath(__file__))
_opencc_rootdir = os.path.abspath(os.path.join(_this_dir, '..', '..'))
_testcases_path = os.path.join(_opencc_rootdir, 'test', 'testcases', 'testcases.json')
_config_test_path = os.path.join(_opencc_rootdir, 'test', 'config_test', 'config_test.json')

_TEXT_ZIP_CONFIG = """{
  "name": "Python Resource Zip Test",
  "segmentation": {
    "type": "mmseg",
    "dict": {
      "type": "text",
      "file": "STPhrases.txt"
    }
  },
  "conversion_chain": [
    {
      "dict": {
        "type": "group",
        "dicts": [
          {
            "type": "text",
            "file": "STPhrases.txt"
          },
          {
            "type": "text",
            "file": "STCharacters.txt"
          }
        ]
      }
    },
    {
      "dict": {
        "type": "text",
        "file": "TWPhrases.txt"
      }
    }
  ]
}
"""


def _write_resource_zip(path: str) -> None:
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED) as archive:
        archive.writestr('s2twp.json', _TEXT_ZIP_CONFIG)
        archive.writestr('STPhrases.txt', "打印机\t印表機\n")
        archive.writestr('STCharacters.txt', "鼠\t鼠\n标\t標\n")
        archive.writestr('TWPhrases.txt', "鼠標\t滑鼠\n")


def test_import():
    import opencc  # noqa


def test_init_delete_converter():
    import opencc

    for config in opencc.CONFIGS:
        converter = opencc.OpenCC(config)
        del converter


def test_jieba_configs_are_not_exposed():
    import opencc

    assert all('jieba' not in config for config in opencc.CONFIGS)


def test_custom_config_resolves_local_dictionaries():
    import opencc

    converter = opencc.OpenCC(_config_test_path)

    assert converter.convert('燕燕于飞，之子于归。') == '燕燕于飛，之子于歸。'
    assert converter.convert('远') == '遠'


def test_custom_config_resolves_absolute_ocd2_path_to_text_dictionary(tmp_path):
    import opencc

    dict_txt = tmp_path / 'CustomPhrases.txt'
    dict_txt.write_text('测试\t測試\n', encoding='utf-8')
    config_path = tmp_path / 'custom.json'
    config_path.write_text(json.dumps({
        'name': 'Custom',
        'segmentation': {
            'type': 'mmseg',
            'dict': {
                'type': 'ocd2',
                'file': str(tmp_path / 'CustomPhrases.ocd2'),
            },
        },
        'conversion_chain': [{
            'dict': {
                'type': 'ocd2',
                'file': str(tmp_path / 'CustomPhrases.ocd2'),
            },
        }],
    }), encoding='utf-8')

    converter = opencc.OpenCC(str(config_path))

    assert converter.convert('测试') == '測試'


def test_dictionary_parser_strips_utf8_bom(tmp_path):
    from opencc import _opencc_pure

    dict_txt = tmp_path / 'BomPhrases.txt'
    dict_txt.write_text('\ufeff测试\t測試\n', encoding='utf-8')
    trie = _opencc_pure._load_trie(str(dict_txt), reverse=False)

    assert trie.prefix_match('测试', 0) == (2, '測試')


def test_conversion():
    import opencc
    import re
    from collections import defaultdict

    with open(_testcases_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Strip comments and trailing commas
    pattern = re.compile(r'"(?:[^"\\]|\\.)*"|(/\*[\s\S]*?\*/|//.*)|(,\s*(?=[\]}]))')
    clean_content = pattern.sub(lambda m: "" if (m.group(1) or m.group(2)) else m.group(0), content)
    parsed = json.loads(clean_content)

    # Group test cases by configuration
    config_cases = defaultdict(list)
    for case in parsed.get('cases', []):
        input_text = case.get('input')
        expected = case.get('expected', {})
        if not input_text or not isinstance(expected, dict):
            continue
        for cfg, ans in expected.items():
            config_cases[cfg].append((input_text, ans))

    # Run conversions config-by-config, reusing the converter instance
    for cfg, cases in config_cases.items():
        converter = opencc.OpenCC(f'{cfg}.json')
        for input_text, ans in cases:
            assert converter.convert(input_text) == ans, \
                'Failed to convert {} for {} -> {}'.format(cfg, input_text, ans)


def test_include_tofu_risk_dictionaries_option():
    import opencc

    assert opencc.OpenCC('t2s.json').convert('㑮') == '𫝈'
    assert opencc.OpenCC(
        't2s.json',
        include_tofu_risk_dictionaries=False,
    ).convert('㑮') == '㑮'


def test_resource_zip_text_dictionary_support(tmp_path):
    import opencc

    resource_zip = tmp_path / 'opencc-resources.zip'
    _write_resource_zip(str(resource_zip))
    converter = opencc.OpenCC(
        's2twp.json',
        resource_zip=str(resource_zip),
    )
    assert converter.convert('打印机和鼠标') == '印表機和滑鼠'


def test_builtin_config_stem_is_normalized():
    import opencc

    assert opencc.OpenCC('s2t').convert('汉字') == '漢字'


def test_custom_config_path_without_json_extension_is_preserved():
    import opencc

    assert opencc._normalize_config_name('custom-config') == 'custom-config'
    assert opencc._normalize_config_name('custom-config.jsonc') == 'custom-config.jsonc'
    assert opencc._normalize_config_name('./s2t') == './s2t'
    assert opencc._normalize_config_name('configs/s2t') == 'configs/s2t'
    assert opencc._normalize_config_name(r'configs\s2t') == r'configs\s2t'


if __name__ == "__main__":
    sys.exit(pytest.main([os.path.abspath(__file__)]))
