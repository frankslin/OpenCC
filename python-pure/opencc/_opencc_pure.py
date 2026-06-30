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

import json
import os
import re
import importlib.util

# Two-pass approach (mirrors node/opencc.js parseJSON logic but split into two
# steps so that "value", // comment\n} correctly strips the trailing comma even
# when a comment sits between the comma and the closing bracket on the same line).
#
# Pass 1 pattern: strip // and /* */ comments outside string literals.
# Pass 2 pattern: strip trailing commas (,<ws>} or ,<ws>]) outside strings.
# Both use the alternation trick: unmatched string literals are passed through;
# only the capture group (comment / trailing comma) is replaced with ''.
_COMMENT_RE = re.compile(r'"(?:[^"\\]|\\.)*"|(//[^\n]*|/\*[\s\S]*?\*/)')
_TRAILING_COMMA_RE = re.compile(r'"(?:[^"\\]|\\.)*"|(,\s*(?=[}\]]))')


def _strip_jsonc(text: str) -> str:
    def _drop_group1(m):
        return '' if m.group(1) else m.group(0)
    text = _COMMENT_RE.sub(_drop_group1, text)
    return _TRAILING_COMMA_RE.sub(_drop_group1, text)


def _load_jsonc(text: str):
    return json.loads(_strip_jsonc(text))

__all__ = ['OpenCC']

_opencc_data = None


def _get_opencc_data():
    global _opencc_data
    if _opencc_data is None:
        try:
            import opencc_data
        except ImportError as exc:
            raise ImportError(
                'opencc-py pure Python resources are provided by the '
                '`opencc-data` package. Install it with `pip install opencc-data`.'
            ) from exc
        _opencc_data = opencc_data
    return _opencc_data


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


# opencc-data resource helpers

def _data_resource(filename: str):
    return _get_opencc_data().data_path(filename or None)


def _config_resource(filename: str):
    return _get_opencc_data().config_path(filename or None)


def _resource_is_file(resource) -> bool:
    try:
        return resource.is_file()
    except (FileNotFoundError, NotADirectoryError):
        return False


def _open_text_resource(resource):
    return resource.open('r', encoding='utf-8-sig')


# Dictionary loading

_trie_cache: dict = {}  # cache_key -> _Trie


def _find_dict_txt(filename: str, config_dir: str = ''):
    """
    Resolve a dictionary filename (typically ``Foo.ocd2``) to a
    ``(source, needs_reverse)`` tuple. ``source`` is either a filesystem
    path for custom/local dictionaries or a ``Traversable`` from
    ``opencc-data`` for built-in dictionaries.

    Resolution order:
    1. Strip the extension (``Foo.ocd2`` → ``Foo``).
    2. Search custom filesystem locations when a config directory is known.
    3. Search ``opencc-data`` packaged dictionaries.
    4. If the stem ends with ``Rev`` (e.g. ``HKVariantsRev``), look for
       the forward dict (``HKVariants``) and mark it for reversal.
    """
    stem = filename
    for ext in ('.ocd2', '.ocd', '.txt'):
        if stem.endswith(ext):
            stem = stem[: -len(ext)]
            break

    if os.path.isabs(filename):
        path = stem + '.txt'
        if os.path.isfile(path):
            return path, False

    search_dirs = (config_dir,)

    for search_dir in search_dirs:
        if not search_dir:
            continue
        path = os.path.join(search_dir, stem + '.txt')
        if os.path.isfile(path):
            return path, False

    resource = _data_resource(stem + '.txt')
    if _resource_is_file(resource):
        return resource, False

    # Try reversed dict: strip the trailing "Rev" and reverse the forward file.
    if stem.endswith('Rev'):
        forward_stem = stem[:-3]
        for search_dir in search_dirs:
            if not search_dir:
                continue
            path = os.path.join(search_dir, forward_stem + '.txt')
            if os.path.isfile(path):
                return path, True
        resource = _data_resource(forward_stem + '.txt')
        if _resource_is_file(resource):
            return resource, True

    raise FileNotFoundError(f'Dictionary file not found for: {filename!r}')


def _parse_dict_lines(source):
    """
    Yield ``(key, candidates)`` tuples for every data line in a txt dict file.
    """
    if isinstance(source, str):
        f = open(source, encoding='utf-8-sig')
    else:
        f = _open_text_resource(source)
    with f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '\t' not in line:
                continue
            key, rest = line.split('\t', 1)
            candidates = rest.split()
            if candidates:
                yield key, candidates


def _load_trie(source, reverse: bool) -> _Trie:
    """
    Load a ``key<TAB>value1 value2 ...`` txt file into a :class:`_Trie`.

    When ``reverse`` is ``True`` the mapping is inverted: each candidate
    value becomes a key whose conversion target is the original key.  When
    multiple original keys share the same candidate value the first
    encountered (in file order) wins, matching the behaviour of the C++
    dict-reversal script.
    """
    cache_source = os.path.abspath(source) if isinstance(source, str) else str(source)
    cache_key = (cache_source, reverse)

    cached = _trie_cache.get(cache_key)
    if cached is not None:
        return cached

    trie = _Trie()

    if not reverse:
        for key, candidates in _parse_dict_lines(source):
            trie.add(key, candidates[0])
    else:
        # Reverse: each candidate value -> original key (first writer wins).
        reversed_mapping: dict = {}
        for key, candidates in _parse_dict_lines(source):
            for candidate in candidates:
                if candidate not in reversed_mapping:
                    reversed_mapping[candidate] = key
        for new_key, new_value in reversed_mapping.items():
            trie.add(new_key, new_value)

    _trie_cache[cache_key] = trie
    return trie


def _get_trie(filename: str, config_dir: str = '') -> _Trie:
    """Resolve ``filename`` and return the loaded trie."""
    source, needs_reverse = _find_dict_txt(filename, config_dir)
    return _load_trie(source, needs_reverse)


# Config parsing

def _parse_dict_node(d: dict, config_dir: str = '',
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
            if (m := _parse_dict_node(sub, config_dir, include_tofu_risk_dicts)) is not None
        ]
        if not matchers:
            return None
        return _GroupMatcher(matchers, policy=policy)

    if d.get('may_output_tofu', False) and not include_tofu_risk_dicts:
        return None

    if dtype in ('ocd2', 'ocd', 'txt', 'text'):
        return _get_trie(d['file'], config_dir)

    if dtype == 'inline':
        trie = _Trie()
        for key, value in d['entries'].items():
            if key and value:
                trie.add(key, value)
        return trie

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
    """
    filename = config_name if config_name.endswith('.json') else config_name + '.json'
    resource = _config_resource(filename)
    if _resource_is_file(resource):
        return resource
    raise FileNotFoundError(f'Config not found: {config_name!r}')


def _config_seg_type(cfg: dict) -> str:
    return cfg.get('segmentation', {}).get('type', '')


def _is_supported_cfg(cfg: dict, config_path: str = '') -> bool:
    """Return True if the pure Python backend can use this parsed config."""
    seg_type = _config_seg_type(cfg)
    if seg_type in ('', 'mmseg'):
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


def list_configs() -> list:
    """
    Return a sorted list of ``.json`` config filenames available to the
    pure Python converter.
    """
    configs = []
    config_dir = _config_resource('')
    for resource in config_dir.iterdir():
        name = resource.name
        if not name.endswith('.json'):
            continue
        try:
            cfg = _load_jsonc(resource.read_text(encoding='utf-8'))
            if _is_supported_cfg(cfg):
                configs.append(name)
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
        if resource_zip is not None:
            raise ValueError(
                'resource_zip is no longer supported; install the opencc-data '
                'package to provide built-in configs and dictionaries.'
            )

        config_name = config[:-5] if config.endswith('.json') else config
        suffixed_config = config if config.endswith('.json') else f'{config}.json'

        # Load the config JSON.
        # Filesystem paths take priority so that custom configs work correctly.
        config_dir = ''
        if os.path.isfile(config):
            with open(config, encoding='utf-8') as f:
                cfg = _load_jsonc(f.read())
            config_dir = os.path.dirname(os.path.abspath(config))
        elif os.path.isfile(suffixed_config):
            with open(suffixed_config, encoding='utf-8') as f:
                cfg = _load_jsonc(f.read())
            config_dir = os.path.dirname(os.path.abspath(suffixed_config))
        else:
            config_resource = _find_config(config_name)
            cfg = _load_jsonc(config_resource.read_text(encoding='utf-8'))

        self.config = suffixed_config

        segmentation = cfg.get('segmentation', {})
        seg_type = segmentation.get('type', '')
        include_tofu = include_tofu_risk_dictionaries
        if seg_type == 'mmseg':
            self._segmenter = _parse_dict_node(segmentation['dict'], config_dir, include_tofu)
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
            if (m := _parse_dict_node(step['dict'], config_dir, include_tofu)) is not None
        ]

        self._chain: list = [
            m for step in cfg['conversion_chain']
            if (m := _parse_dict_node(step['dict'], config_dir, include_tofu)) is not None
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
