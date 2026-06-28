import json
import os
import re
import shutil
import subprocess

import setuptools
import setuptools.command.build_py

_this_dir = os.path.dirname(os.path.abspath(__file__))
_repo_root = os.path.abspath(os.path.join(_this_dir, '..'))

_author_file = os.path.join(_repo_root, 'AUTHORS')
_readme_file = os.path.join(_repo_root, 'README.md')
_fallback_version = '1.3.1'


def _get_version_from_git():
    try:
        raw = subprocess.check_output(
            ['git', 'describe', '--tags', '--long', '--always'],
            cwd=_repo_root,
            stderr=subprocess.DEVNULL,
        ).decode('utf-8').strip()
    except (OSError, subprocess.CalledProcessError):
        return ''

    dirty = ''
    for diff_cmd in (['git', 'diff', '--quiet'], ['git', 'diff', '--cached', '--quiet']):
        try:
            subprocess.check_call(
                diff_cmd,
                cwd=_repo_root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except (OSError, subprocess.CalledProcessError):
            dirty = '.dirty'
            break

    release_match = re.match(r'^(?:v|ver\.)(\d+\.\d+\.\d+)-0-g[0-9a-f]+$', raw)
    if release_match:
        return '{}{}'.format(release_match.group(1), dirty)

    dev_match = re.match(r'^(?:v|ver\.)(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)$', raw)
    if dev_match:
        return '{}.dev{}+g{}{}'.format(
            dev_match.group(1),
            dev_match.group(2),
            dev_match.group(3),
            dirty,
        )

    return '{}+g{}{}'.format(_fallback_version, raw, dirty)


def get_version_info():
    env_version = os.environ.get('VERSION', '')
    if env_version:
        return env_version.lstrip('v')
    git_version = _get_version_from_git()
    if git_version:
        return git_version
    return _fallback_version


def get_author_info():
    if not os.path.isfile(_author_file):
        return 'BYVoid', 'byvoid@byvoid.com'

    authors = []
    emails = []
    author_pattern = re.compile(r'(.+) <(.+)>')
    with open(_author_file, 'rb') as f:
        for line in f:
            match = author_pattern.search(line.decode('utf-8'))
            if not match:
                continue
            authors.append(match.group(1))
            emails.append(match.group(2))
    if not authors:
        return 'BYVoid', 'byvoid@byvoid.com'
    return ', '.join(authors), ', '.join(emails)


def get_long_description():
    if not os.path.isfile(_readme_file):
        return ''
    with open(_readme_file, encoding='utf-8') as f:
        return f.read()


def _load_trie_from_txt(path):
    """Build a minimal {key: first_value} prefix trie from a .txt dict file."""
    trie = {}
    with open(path, encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '\t' not in line:
                continue
            key, rest = line.split('\t', 1)
            value = rest.split()[0]
            node = trie
            for i, ch in enumerate(key):
                if ch not in node:
                    node[ch] = {}
                node = node[ch]
            node.setdefault('__v__', value)
    return trie


def _trie_match(trie, text, pos):
    """Longest prefix match; returns (length, value) or (0, None)."""
    node = trie
    best_len, best_val = 0, None
    i = pos
    while i < len(text):
        node = node.get(text[i])
        if node is None:
            break
        i += 1
        if '__v__' in node:
            best_len, best_val = i - pos, node['__v__']
    return best_len, best_val


def _t2s_convert(text, tries):
    """Convert traditional text to simplified using an ordered list of tries
    (short-circuit: first trie that matches at a position wins)."""
    result = []
    pos = 0
    while pos < len(text):
        matched = False
        for trie in tries:
            length, value = _trie_match(trie, text, pos)
            if length > 0:
                result.append(value)
                pos += length
                matched = True
                break
        if not matched:
            result.append(text[pos])
            pos += 1
    return ''.join(result)


def _generate_st_phrases_from_regional(src_dict, dst_dict):
    """Generate STPhrases_GeneratedFromRegionalPhrases.txt in dst_dict.

    Mirrors the logic of data/scripts/generate_st_phrases_from_regional_phrases.py:
    convert TWPhrases/HKPhrases keys via t2s and emit keys with len >= 3.
    """
    ts_phrases_path = os.path.join(src_dict, 'TSPhrases.txt')
    ts_chars_path = os.path.join(src_dict, 'TSCharacters.txt')
    if not os.path.isfile(ts_phrases_path) or not os.path.isfile(ts_chars_path):
        return

    tries = [_load_trie_from_txt(ts_phrases_path),
             _load_trie_from_txt(ts_chars_path)]

    collisions = {}  # simplified_key -> first_traditional_key
    for fname in ('TWPhrases.txt', 'HKPhrases.txt'):
        path = os.path.join(src_dict, fname)
        if not os.path.isfile(path):
            continue
        with open(path, encoding='utf-8-sig') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '\t' not in line:
                    continue
                original_key = line.split('\t', 1)[0]
                simplified_key = _t2s_convert(original_key, tries)
                if len(simplified_key) < 3:
                    continue
                collisions.setdefault(simplified_key, original_key)

    out_path = os.path.join(dst_dict, 'STPhrases_GeneratedFromRegionalPhrases.txt')
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Open Chinese Convert (OpenCC) Dictionary\n')
        f.write('# File: STPhrases_GeneratedFromRegionalPhrases.txt\n')
        f.write('# Format: key\tvalue(s) (values separated by spaces)\n')
        f.write('# License: Apache-2.0 (see LICENSE)\n')
        f.write('# Source: generated from TWPhrases.txt, HKPhrases.txt keys via t2s\n')
        f.write('# Used in configs: s2t.json, s2hk.json, s2tw.json\n')
        f.write('#\n')
        f.write('\n')
        for key in sorted(collisions):
            f.write('{}\t{}\n'.format(key, collisions[key]))


class BuildPyCommand(setuptools.command.build_py.build_py, object):
    """Bundle OpenCC's JSON configs and text dictionaries into the package."""

    def run(self):
        super(BuildPyCommand, self).run()
        self._copy_opencc_data()

    def _copy_opencc_data(self):
        src_config = os.path.join(_repo_root, 'data', 'config')
        src_dict = os.path.join(_repo_root, 'data', 'dictionary')
        src_jieba_config = os.path.join(_repo_root, 'plugins', 'jieba', 'data', 'config')
        src_jieba_dict = os.path.join(_repo_root, 'plugins', 'jieba', 'deps', 'cppjieba', 'dict')
        dst_base = os.path.join(self.build_lib, 'opencc')
        dst_config = os.path.join(dst_base, 'config')
        dst_dict = os.path.join(dst_base, 'dictionary')
        dst_jieba_dict = os.path.join(dst_base, 'jieba_dict')

        os.makedirs(dst_config, exist_ok=True)
        for fname in os.listdir(src_config):
            if not fname.endswith('.json'):
                continue
            src_config_path = os.path.join(src_config, fname)
            with open(src_config_path, encoding='utf-8') as f:
                config = json.load(f)
            if config.get('segmentation', {}).get('type') != 'mmseg':
                continue
            shutil.copy2(src_config_path, os.path.join(dst_config, fname))
        if os.path.isdir(src_jieba_config):
            for fname in os.listdir(src_jieba_config):
                if fname.endswith('.json'):
                    shutil.copy2(
                        os.path.join(src_jieba_config, fname),
                        os.path.join(dst_config, fname),
                    )

        os.makedirs(dst_dict, exist_ok=True)
        for fname in os.listdir(src_dict):
            if fname.endswith('.txt'):
                shutil.copy2(
                    os.path.join(src_dict, fname),
                    os.path.join(dst_dict, fname),
                )

        _generate_st_phrases_from_regional(src_dict, dst_dict)

        os.makedirs(dst_jieba_dict, exist_ok=True)
        for fname in ('jieba.dict.utf8', 'user.dict.utf8'):
            src_path = os.path.join(src_jieba_dict, fname)
            if os.path.isfile(src_path):
                shutil.copy2(src_path, os.path.join(dst_jieba_dict, fname))


version_info = get_version_info()
author_info = get_author_info()

setuptools.setup(
    name='opencc-py',
    version=version_info,
    author=author_info[0],
    author_email=author_info[1],
    description='Conversion between Traditional and Simplified Chinese (pure Python)',
    long_description=get_long_description(),
    long_description_content_type='text/markdown',
    url='https://github.com/BYVoid/OpenCC',

    packages=['opencc'],
    package_dir={'opencc': 'opencc'},
    package_data={
        'opencc': ['py.typed', 'config/*.json', 'dictionary/*.txt', 'jieba_dict/*.utf8'],
    },
    cmdclass={
        'build_py': BuildPyCommand,
    },

    python_requires='>=3.8',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Intended Audience :: Science/Research',
        'Natural Language :: Chinese (Simplified)',
        'Natural Language :: Chinese (Traditional)',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: Apache Software License',
        'Topic :: Scientific/Engineering',
        'Topic :: Software Development',
        'Topic :: Software Development :: Libraries',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Software Development :: Localization',
        'Topic :: Text Processing :: Linguistic',
        'Typing :: Typed',
    ],
    license='Apache License 2.0',
    keywords=['opencc', 'convert', 'chinese'],
)
