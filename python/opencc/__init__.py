import os
from importlib import metadata

from .opencc import OpenCC as _PureOpenCC

__all__ = ['CONFIGS', 'OpenCC', '__version__']

_this_dir = os.path.dirname(os.path.abspath(__file__))
_opencc_config_dir = os.path.join(_this_dir, 'config')

if os.path.isdir(_opencc_config_dir):
    CONFIGS = sorted(f for f in os.listdir(_opencc_config_dir) if f.endswith('.json'))
else:
    CONFIGS = []


def _detect_version() -> str:
    for package_name in ('OpenCC', 'opencc-python-reimplemented'):
        try:
            return metadata.version(package_name)
        except metadata.PackageNotFoundError:
            continue
    return 'dev'


def _normalize_config(config: str) -> str:
    normalized = config
    if normalized.endswith('.json'):
        normalized = normalized[:-5]
    if os.path.isfile(config):
        base_name = os.path.basename(config)
        if base_name.endswith('.json'):
            normalized = base_name[:-5]
        else:
            normalized = base_name
    return normalized


__version__ = _detect_version()


class OpenCC:

    def __init__(self, config: str = 't2s') -> None:
        self.config = config if config.endswith('.json') else f'{config}.json'
        normalized_config = _normalize_config(config)
        self._converter = _PureOpenCC(normalized_config)

    def convert(self, text: str) -> str:
        return self._converter.convert(text)
