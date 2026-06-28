"""
Pure Python implementation of the OpenCC Chinese conversion algorithm.

Algorithm overview (mirrors the C++ reference implementation):

  Dictionary (.txt)
    Each line: ``key<TAB>value1 value2 ...``
    The first listed candidate is used as the conversion target.

  Trie
    Character-by-character prefix tree.  Built per dictionary file.
    ``prefix_match(text, pos)`` returns ``(matched_length, value)``
    for the *longest* match starting at ``text[pos]``.

  DictGroup  (_GroupMatcher)
    An ordered list of tries.  At each position the tries are tried in
    declaration order; the **first** trie that has any match (not the
    globally longest) wins.  This gives phrase dictionaries priority
    over character dictionaries, mirroring the C++ PrefixMatch logic.

  Conversion
    Scans the text left-to-right.  At each position the active
    group/dict matcher is consulted; the matched substring is replaced
    with the dictionary value.  On no match, exactly one character is
    passed through unchanged.

  MaxMatch Segmentation
    Same scan as Conversion, but instead of replacing tokens the
    matched keys are emitted as segment boundaries.  Unmatched
    characters accumulate in a buffer that is flushed as a single
    segment when the next match is found or the string ends.

  Conversion Chain
    Multiple conversion steps applied sequentially to each segment
    produced by the segmenter.  Each step uses an independent
    group/dict matcher.
"""

import io
import json
import os
import importlib.util
import zipfile
from pathlib import Path

__all__ = ['OpenCC']

_this_dir = os.path.dirname(os.path.abspath(__file__))

# Bundled resource zip (takes priority when present alongside the package).
_pkg_resource_zip = os.path.join(_this_dir, 'opencc-resources.zip')

# Legacy per-directory layout (kept for Bazel runfile and dev-tree fallback).
_pkg_config_dir = os.path.join(_this_dir, 'config')
_pkg_dict_dir = os.path.join(_this_dir, 'dictionary')
_pkg_jieba_dict_dir = os.path.join(_this_dir, 'jieba_dict')


_MAX_PARENT_TRAVERSAL_DEPTH = 8


def _runfile_dir(relative_path: str) -> str:
    runfiles_root = os.environ.get('RUNFILES_DIR')
    workspace = os.environ.get('TEST_WORKSPACE', '_main')
    if not runfiles_root:
        return ''

    for candidate in (
            Path(runfiles_root) / workspace / relative_path,
            Path(runfiles_root) / relative_path):
        if candidate.is_dir():
            return str(candidate)
    return ''


def _find_repo_root() -> str:
    """
    Walk up the directory tree to find the OpenCC repo root.

    Detects the repo by the presence of ``data/config/`` and
    ``data/dictionary/`` subdirectories.  Returns an empty string when the
    repo root cannot be determined (e.g. in a standalone installed package
    without bundled data files).
    """
    candidate = _this_dir
    for _ in range(_MAX_PARENT_TRAVERSAL_DEPTH):
        if (os.path.isdir(os.path.join(candidate, 'data', 'config')) and
                os.path.isdir(os.path.join(candidate, 'data', 'dictionary'))):
            return candidate
        parent = os.path.dirname(candidate)
        if parent == candidate:
            break
        candidate = parent
    return ''


_repo_root = _find_repo_root()
_repo_config_dir = os.path.join(_repo_root, 'data', 'config') if _repo_root else ''
_repo_dict_dir = os.path.join(_repo_root, 'data', 'dictionary') if _repo_root else ''
_repo_jieba_config_dir = os.path.join(_repo_root, 'plugins', 'jieba', 'data', 'config') if _repo_root else ''
_repo_jieba_dict_dir = os.path.join(_repo_root, 'plugins', 'jieba', 'deps', 'cppjieba', 'dict') if _repo_root else ''
_runfiles_config_dir = _runfile_dir('data/config')
_runfiles_dict_dir = _runfile_dir('data/dictionary')
_runfiles_jieba_config_dir = _runfile_dir('plugins/jieba/data/config')
_runfiles_jieba_dict_dir = _runfile_dir('plugins/jieba/deps/cppjieba/dict')


# Trie

class _TrieNode:
    """Single node in the character trie."""

    __slots__ = ('children', 'value')

    def __init__(self):
        self.children = {}  # char -> _TrieNode
        self.value = None   # str or None; non-None marks a terminal node


class _Trie:
    """
    Character-by-character trie for longest-prefix matching.

    Mirrors the inner ``Table`` class in ``PrefixMatch.cpp``.
    """

    __slots__ = ('root',)

    def __init__(self):
        self.root = _TrieNode()

    def add(self, key: str, value: str) -> None:
        """Insert ``key -> value`` into the trie."""
        node = self.root
        for ch in key:
            child = node.children.get(ch)
            if child is None:
                child = _TrieNode()
                node.children[ch] = child
            node = child
        node.value = value

    def prefix_match(self, text: str, pos: int):
        """
        Find the longest entry whose key is a prefix of ``text[pos:]``.

        Returns ``(matched_length, value)``; ``matched_length`` is 0 when
        no entry matches.
        """
        node = self.root
        matched_len = 0
        matched_value = None
        i = pos
        n = len(text)
        while i < n:
            child = node.children.get(text[i])
            if child is None:
                break
            node = child
            i += 1
            if node.value is not None:
                matched_len = i - pos
                matched_value = node.value
        return matched_len, matched_value

    def match(self, text: str, pos: int):
        return self.prefix_match(text, pos)


# DictGroup

class _GroupMatcher:
    """
    Ordered collection of sub-matchers with a configurable match policy.

    ``short_circuit`` (default): tries sub-matchers in order; the **first**
    sub-matcher that has any match returns its longest result for that entry.
    Mirrors ``PrefixMatch`` with a ``short_circuit`` group policy.

    ``union``: tries all sub-matchers and returns the globally longest match
    across all of them.  Mirrors the ``union`` group policy.
    """

    __slots__ = ('matchers', 'policy')

    def __init__(self, matchers, policy: str = 'short_circuit'):
        self.matchers = list(matchers)
        self.policy = policy

    def match(self, text: str, pos: int):
        """
        Return ``(matched_length, value)`` according to the group policy.
        Returns ``(0, None)`` when no sub-matcher has a match.
        """
        if self.policy == 'union':
            best_len, best_val = 0, None
            for m in self.matchers:
                length, value = m.match(text, pos)
                if length > best_len:
                    best_len, best_val = length, value
            return best_len, best_val
        else:  # short_circuit
            for m in self.matchers:
                length, value = m.match(text, pos)
                if length > 0:
                    return length, value
            return 0, None


# Jieba segmentation

_jieba_tokenizer_cache: dict = {}


class _JiebaSegmenter:
    """
    Optional Jieba segmenter backed by the ``jieba`` Python package.

    The dependency is intentionally lazy: importing ``opencc`` and using the
    normal mmseg configs never imports or requires ``jieba``.
    """

    __slots__ = ('tokenizer',)

    def __init__(self, resources: dict, config_dir: str = ''):
        try:
            import jieba
        except ImportError as exc:
            raise ImportError(
                "Config uses Jieba segmentation. Install the optional "
                "dependency with `pip install jieba` to use *_jieba configs."
            ) from exc

        dict_path = _find_jieba_resource(
            resources.get('dict_path', ''),
            config_dir,
            'jieba.dict.utf8',
        )
        user_dict_path = _find_jieba_resource(
            resources.get('user_dict_path', ''),
            config_dir,
            'user.dict.utf8',
            required=False,
        )

        cache_key = (dict_path, user_dict_path)
        tokenizer = _jieba_tokenizer_cache.get(cache_key)
        if tokenizer is None:
            tokenizer = jieba.Tokenizer(dictionary=dict_path)
            tokenizer.initialize()
            if user_dict_path:
                tokenizer.load_userdict(user_dict_path)
            _jieba_tokenizer_cache[cache_key] = tokenizer
        self.tokenizer = tokenizer

    def segment(self, text: str) -> list:
        return list(self.tokenizer.cut(text, HMM=True))


def _jieba_available() -> bool:
    return importlib.util.find_spec('jieba') is not None


def _find_jieba_resource(raw_path: str,
                         config_dir: str,
                         fallback_name: str,
                         required: bool = True) -> str:
    """
    Resolve Jieba resources for the pure Python optional backend.

    Plugin configs point at ``jieba_merged.ocd2`` for the C++ plugin.  Python
    ``jieba`` consumes cppjieba's text dictionaries directly, so that request
    is mapped to ``jieba.dict.utf8`` plus ``user.dict.utf8``.
    """
    candidates = []

    if raw_path:
        if raw_path.endswith('jieba_merged.ocd2'):
            candidates.append(raw_path[:-len('jieba_merged.ocd2')] + fallback_name)
            candidates.append(fallback_name)
        else:
            candidates.append(raw_path)
            candidates.append(os.path.join(os.path.dirname(raw_path), fallback_name))
            candidates.append(fallback_name)
    else:
        candidates.append(fallback_name)

    search_dirs = (
        '',
        config_dir,
        os.path.dirname(config_dir) if config_dir else '',
        _pkg_jieba_dict_dir,
        _runfiles_jieba_dict_dir,
        _repo_jieba_dict_dir,
    )

    seen = set()
    for candidate in candidates:
        for search_dir in search_dirs:
            if not candidate:
                continue
            path = candidate if os.path.isabs(candidate) or not search_dir else os.path.join(search_dir, candidate)
            norm = os.path.abspath(path)
            if norm in seen:
                continue
            seen.add(norm)
            if os.path.isfile(path):
                return path

    if required:
        raise FileNotFoundError(f'Jieba resource not found: {fallback_name!r}')
    return ''


# Zip-backed resource loader

class _ZipLoader:
    """Read configs and dicts from a flat OpenCC resource zip archive.

    The zip produced by ``//data:opencc_resources_zip`` stores all ``.json``
    and ``.txt`` files at the root level with no subdirectories.
    """

    __slots__ = ('_zf', '_zip_path', '_names')

    def __init__(self, zip_path: str) -> None:
        self._zip_path = zip_path
        self._zf = zipfile.ZipFile(zip_path, 'r')
        self._names: frozenset = frozenset(self._zf.namelist())

    def has_txt(self, stem: str) -> bool:
        return (stem + '.txt') in self._names

    def open_txt(self, stem: str):
        """Return a text stream for ``stem.txt``."""
        return io.TextIOWrapper(self._zf.open(stem + '.txt'), encoding='utf-8-sig')

    def has_config(self, name: str) -> bool:
        fname = name if name.endswith('.json') else name + '.json'
        return fname in self._names

    def read_config(self, name: str) -> dict:
        fname = name if name.endswith('.json') else name + '.json'
        return json.loads(self._zf.read(fname).decode('utf-8'))

    def list_config_names(self) -> list:
        return sorted(n for n in self._names if n.endswith('.json'))

    def cache_key(self, stem: str, reverse: bool) -> tuple:
        return (self._zip_path, stem, reverse)

    def close(self) -> None:
        self._zf.close()

    def __del__(self) -> None:
        try:
            self._zf.close()
        except Exception:
            pass


# Dictionary loading

_trie_cache: dict = {}  # cache_key -> _Trie


def _find_dict_txt(filename: str, config_dir: str = '',
                   zip_loader: '_ZipLoader | None' = None):
    """
    Resolve a dictionary filename (typically ``Foo.ocd2``) to a
    ``(name_or_path, needs_reverse)`` tuple.

    When ``zip_loader`` is given, ``name_or_path`` is the bare stem (e.g.
    ``'STPhrases'``) and all I/O goes through the zip.  Otherwise it is an
    absolute filesystem path.

    Resolution order:
    1. Strip the extension (``Foo.ocd2`` → ``Foo``).
    2. Zip lookup or filesystem search (config dir → pkg dir → runfiles → repo).
    3. If the stem ends with ``Rev`` (e.g. ``HKVariantsRev``), look for
       the forward dict (``HKVariants``) and mark it for reversal.
    """
    stem = filename
    for ext in ('.ocd2', '.ocd', '.txt'):
        if stem.endswith(ext):
            stem = stem[: -len(ext)]
            break

    if zip_loader is not None:
        if zip_loader.has_txt(stem):
            return stem, False
        if stem.endswith('Rev'):
            forward_stem = stem[:-3]
            if zip_loader.has_txt(forward_stem):
                return forward_stem, True
        raise FileNotFoundError(f'Dictionary file not found in zip for: {filename!r}')

    if os.path.isabs(filename):
        path = stem + '.txt'
        if os.path.isfile(path):
            return path, False

    search_dirs = (
        config_dir,
        _pkg_dict_dir,
        _runfiles_dict_dir,
        _repo_dict_dir,
    )

    for search_dir in search_dirs:
        if not search_dir:
            continue
        path = os.path.join(search_dir, stem + '.txt')
        if os.path.isfile(path):
            return path, False

    # Try reversed dict: strip the trailing "Rev" and reverse the forward file.
    if stem.endswith('Rev'):
        forward_stem = stem[:-3]
        for search_dir in search_dirs:
            if not search_dir:
                continue
            path = os.path.join(search_dir, forward_stem + '.txt')
            if os.path.isfile(path):
                return path, True

    raise FileNotFoundError(f'Dictionary file not found for: {filename!r}')


def _parse_dict_lines(name_or_path: str,
                      zip_loader: '_ZipLoader | None' = None):
    """
    Yield ``(key, candidates)`` tuples for every data line in a txt dict file.

    When ``zip_loader`` is given, ``name_or_path`` is a bare stem read from
    the zip; otherwise it is a filesystem path.
    """
    if zip_loader is not None:
        f = zip_loader.open_txt(name_or_path)
    else:
        f = open(name_or_path, encoding='utf-8-sig')
    with f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '\t' not in line:
                continue
            key, rest = line.split('\t', 1)
            candidates = rest.split()
            if candidates:
                yield key, candidates


def _load_trie(name_or_path: str, reverse: bool,
               zip_loader: '_ZipLoader | None' = None) -> _Trie:
    """
    Load a ``key<TAB>value1 value2 ...`` txt file into a :class:`_Trie`.

    When ``reverse`` is ``True`` the mapping is inverted: each candidate
    value becomes a key whose conversion target is the original key.  When
    multiple original keys share the same candidate value the first
    encountered (in file order) wins, matching the behaviour of the C++
    dict-reversal script.
    """
    if zip_loader is not None:
        cache_key = zip_loader.cache_key(name_or_path, reverse)
    else:
        cache_key = (os.path.abspath(name_or_path), reverse)

    cached = _trie_cache.get(cache_key)
    if cached is not None:
        return cached

    trie = _Trie()

    if not reverse:
        for key, candidates in _parse_dict_lines(name_or_path, zip_loader):
            trie.add(key, candidates[0])
    else:
        # Reverse: each candidate value -> original key (first writer wins).
        reversed_mapping: dict = {}
        for key, candidates in _parse_dict_lines(name_or_path, zip_loader):
            for candidate in candidates:
                if candidate not in reversed_mapping:
                    reversed_mapping[candidate] = key
        for new_key, new_value in reversed_mapping.items():
            trie.add(new_key, new_value)

    _trie_cache[cache_key] = trie
    return trie


def _get_trie(filename: str, config_dir: str = '',
              zip_loader: '_ZipLoader | None' = None) -> _Trie:
    """Resolve ``filename`` and return the loaded trie.

    Tries the filesystem first (catches both source and Bazel runfile
    locations), then falls back to the resource zip for generated files
    that are not present in the source tree.
    """
    try:
        fs_path, needs_reverse = _find_dict_txt(filename, config_dir, zip_loader=None)
        return _load_trie(fs_path, needs_reverse, zip_loader=None)
    except FileNotFoundError:
        pass
    if zip_loader is not None:
        stem, needs_reverse = _find_dict_txt(filename, config_dir, zip_loader=zip_loader)
        return _load_trie(stem, needs_reverse, zip_loader=zip_loader)
    raise FileNotFoundError(f'Dictionary file not found for: {filename!r}')


# Config parsing

def _parse_dict_node(d: dict, config_dir: str = '',
                     zip_loader: '_ZipLoader | None' = None,
                     include_tofu_risk_dicts: bool = True):
    """
    Recursively parse a JSON dict-config node.

    Returns a :class:`_Trie` for leaf nodes, a :class:`_GroupMatcher` for
    group nodes, or ``None`` when a dict is suppressed because
    ``may_output_tofu`` is true and ``include_tofu_risk_dicts`` is false.
    Mirrors ``ConfigInternal::ParseDict`` in ``Config.cpp``.
    """
    dtype = d['type']

    if dtype == 'group':
        policy = d.get('match_policy', 'short_circuit')
        matchers = [
            m for sub in d['dicts']
            if (m := _parse_dict_node(sub, config_dir, zip_loader, include_tofu_risk_dicts)) is not None
        ]
        if not matchers:
            return None
        return _GroupMatcher(matchers, policy=policy)

    if d.get('may_output_tofu', False) and not include_tofu_risk_dicts:
        return None

    if dtype in ('ocd2', 'ocd', 'txt', 'text'):
        return _get_trie(d['file'], config_dir, zip_loader)

    raise ValueError(f'Unknown dict type: {dtype!r}')


# Core conversion routines

def _convert_phrase(text: str, matcher: _GroupMatcher) -> str:
    """
    Convert *text* using left-to-right longest-prefix matching.

    At each position the group matcher is consulted (first-trie-wins
    semantics).  On a match the matched substring is replaced by the
    dictionary value.  On no match exactly one character is passed through
    unchanged, mirroring ``Conversion::AppendConverted`` in the C++ code.
    """
    parts = []
    i = 0
    n = len(text)
    while i < n:
        length, value = matcher.match(text, i)
        if length > 0:
            parts.append(value)
            i += length
        else:
            parts.append(text[i])
            i += 1
    return ''.join(parts)


def _segment(text: str, matcher: _GroupMatcher) -> list:
    """
    Max-match segmentation of *text*.

    Scans left-to-right using the segmentation dict.  On a match the
    pending character buffer is flushed as one segment and the matched key
    becomes the next segment.  Unmatched characters accumulate until the
    next match or end of string.

    Mirrors ``MaxMatchSegmentation::Segment`` in the C++ code.
    """
    segments = []
    buf = []
    i = 0
    n = len(text)
    while i < n:
        length, _ = matcher.match(text, i)
        if length > 0:
            if buf:
                segments.append(''.join(buf))
                buf = []
            segments.append(text[i: i + length])
            i += length
        else:
            buf.append(text[i])
            i += 1
    if buf:
        segments.append(''.join(buf))
    return segments


# Config location helpers

def _find_config(config_name: str) -> str:
    """
    Locate a config JSON file by name (with or without ``.json`` suffix).

    Searches the bundled package config directory first, then the source-tree
    ``data/config`` directory as a fallback.
    """
    filename = config_name if config_name.endswith('.json') else config_name + '.json'
    for search_dir in (
            _pkg_config_dir,
            _runfiles_config_dir,
            _repo_config_dir,
            _runfiles_jieba_config_dir,
            _repo_jieba_config_dir):
        if not search_dir:
            continue
        path = os.path.join(search_dir, filename)
        if os.path.isfile(path):
            return path
    raise FileNotFoundError(f'Config not found: {config_name!r}')


def _default_zip_loader() -> '_ZipLoader | None':
    """Return a _ZipLoader for the bundled resource zip, or None."""
    env_zip = os.environ.get('OPENCC_RESOURCE_ZIP', '')
    if env_zip and os.path.isfile(env_zip):
        return _ZipLoader(env_zip)
    if os.path.isfile(_pkg_resource_zip):
        return _ZipLoader(_pkg_resource_zip)
    return None


def _config_seg_type(cfg: dict) -> str:
    return cfg.get('segmentation', {}).get('type', '')


def _config_uses_subdir_dicts(cfg: dict) -> bool:
    """Return True if the config references any dict file under a subdirectory."""
    def _check(value) -> bool:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'file' and isinstance(child, str) and '/' in child:
                    return True
                if _check(child):
                    return True
        elif isinstance(value, list):
            for item in value:
                if _check(item):
                    return True
        return False
    return _check(cfg)


def _is_supported_cfg(cfg: dict, config_path: str = '') -> bool:
    """Return True if the pure Python backend can use this parsed config."""
    seg_type = _config_seg_type(cfg)
    if seg_type == 'mmseg':
        return True
    if seg_type == 'jieba':
        if not _jieba_available():
            return False
        resources = cfg.get('segmentation', {}).get('resources', {})
        config_dir = os.path.dirname(config_path) if config_path else ''
        try:
            _find_jieba_resource(resources.get('dict_path', ''), config_dir, 'jieba.dict.utf8')
            return True
        except FileNotFoundError:
            return False
    return False


def list_configs(resource_zip: 'str | None' = None) -> list:
    """
    Return a sorted list of ``.json`` config filenames available to the
    pure Python converter.  Jieba configs are listed only when the optional
    ``jieba`` package and dictionary data are available.

    When ``resource_zip`` is given (or the package ships a bundled
    ``opencc-resources.zip``), configs are enumerated from the zip.
    """
    zip_loader: '_ZipLoader | None' = None
    if resource_zip is not None:
        zip_loader = _ZipLoader(resource_zip)
    elif resource_zip is None:
        zip_loader = _default_zip_loader()

    if zip_loader is not None:
        try:
            configs = []
            seen: set = set()
            for name in zip_loader.list_config_names():
                try:
                    cfg = zip_loader.read_config(name)
                    if _is_supported_cfg(cfg):
                        configs.append(name)
                        seen.add(name)
                except Exception:
                    pass
            # Jieba configs are not bundled in the zip; scan filesystem.
            for search_dir in (_runfiles_jieba_config_dir, _repo_jieba_config_dir):
                if not search_dir or not os.path.isdir(search_dir):
                    continue
                for fname in sorted(os.listdir(search_dir)):
                    if not fname.endswith('.json') or fname in seen:
                        continue
                    path = os.path.join(search_dir, fname)
                    try:
                        with open(path, encoding='utf-8') as f:
                            cfg = json.load(f)
                        if _is_supported_cfg(cfg, path) and not _config_uses_subdir_dicts(cfg):
                            configs.append(fname)
                            seen.add(fname)
                    except Exception:
                        pass
            return sorted(configs)
        finally:
            zip_loader.close()

    configs = []
    seen: set = set()
    for search_dir in (
            _pkg_config_dir,
            _runfiles_config_dir,
            _repo_config_dir,
            _runfiles_jieba_config_dir,
            _repo_jieba_config_dir):
        if not search_dir or not os.path.isdir(search_dir):
            continue
        for fname in os.listdir(search_dir):
            if not fname.endswith('.json') or fname in seen:
                continue
            path = os.path.join(search_dir, fname)
            try:
                with open(path, encoding='utf-8') as f:
                    cfg = json.load(f)
                if _is_supported_cfg(cfg, path):
                    configs.append(fname)
                    seen.add(fname)
            except Exception:
                pass
    return sorted(configs)


# Public API

class OpenCC:
    """
    Pure Python OpenCC converter.

    Usage::

        cc = OpenCC('s2t')          # or 's2t.json'
        result = cc.convert('汉字')  # -> '漢字'

    The ``config`` argument accepts a conversion name (e.g. ``'s2t'``) or
    a bare filename (e.g. ``'s2t.json'``).  Custom absolute config paths
    are also accepted.
    """

    def __init__(self, config: str = 't2s',
                 resource_zip: 'str | None' = None,
                 include_tofu_risk_dictionaries: bool = True) -> None:
        config_name = config[:-5] if config.endswith('.json') else config
        suffixed_config = config if config.endswith('.json') else f'{config}.json'

        # Determine the active zip loader.
        if resource_zip is not None:
            zip_loader: '_ZipLoader | None' = _ZipLoader(resource_zip)
        else:
            zip_loader = _default_zip_loader()
        self._zip_loader = zip_loader

        # Load the config JSON.
        # Filesystem paths take priority over the zip so that custom configs
        # and jieba plugin configs (not bundled in the zip) work correctly.
        config_dir = ''
        if os.path.isfile(config):
            with open(config, encoding='utf-8') as f:
                cfg = json.load(f)
            config_dir = os.path.dirname(os.path.abspath(config))
        elif os.path.isfile(suffixed_config):
            with open(suffixed_config, encoding='utf-8') as f:
                cfg = json.load(f)
            config_dir = os.path.dirname(os.path.abspath(suffixed_config))
        elif zip_loader is not None and zip_loader.has_config(config_name):
            cfg = zip_loader.read_config(config_name)
        else:
            config_path = _find_config(config_name)
            with open(config_path, encoding='utf-8') as f:
                cfg = json.load(f)
            config_dir = os.path.dirname(config_path)

        self.config = suffixed_config

        segmentation = cfg.get('segmentation', {})
        seg_type = segmentation.get('type', '')
        include_tofu = include_tofu_risk_dictionaries
        # Dict loading always passes zip_loader as a fallback for generated files
        # that are not present in the source tree (e.g. STPhrases_Generated…, TSCharactersExt).
        if seg_type == 'mmseg':
            self._segmenter = _parse_dict_node(segmentation['dict'], config_dir, zip_loader, include_tofu)
        elif seg_type == 'jieba':
            self._segmenter = _JiebaSegmenter(
                segmentation.get('resources', {}),
                config_dir,
            )
        elif seg_type == '':
            self._segmenter = None  # no segmentation; whole text is one segment
        else:
            raise ValueError(
                f"Config {config_name!r} uses segmentation type {seg_type!r} "
                f"which is not supported by the pure Python backend."
            )

        self._normalization: list = [
            m for step in cfg.get('normalization', [])
            if (m := _parse_dict_node(step['dict'], config_dir, zip_loader, include_tofu)) is not None
        ]

        self._chain: list = [
            m for step in cfg['conversion_chain']
            if (m := _parse_dict_node(step['dict'], config_dir, zip_loader, include_tofu)) is not None
        ]

    def convert(self, text: str) -> str:
        """Convert *text* and return the result."""
        for matcher in self._normalization:
            text = _convert_phrase(text, matcher)
        if self._segmenter is None:
            segments = [text]
        elif isinstance(self._segmenter, _JiebaSegmenter):
            segments = self._segmenter.segment(text)
        else:
            segments = _segment(text, self._segmenter)
        result = []
        for seg in segments:
            converted = seg
            for matcher in self._chain:
                converted = _convert_phrase(converted, matcher)
            result.append(converted)
        return ''.join(result)
