import os
from importlib import metadata

_this_dir = os.path.dirname(os.path.abspath(__file__))
_opencc_share_dir = os.path.join(_this_dir, 'clib', 'share', 'opencc')
_opencc_rootdir = os.path.abspath(os.path.join(_this_dir, '..', '..'))
_opencc_configdir = os.path.join(_opencc_rootdir, 'data', 'config')
_pure_mode_enabled = os.environ.get('OPENCC_PURE_PYTHON', '').lower() in ('1', 'true', 'yes')

__all__ = ['CONFIGS', 'OpenCC', '__version__']

opencc_clib = None
if not _pure_mode_enabled:
    try:
        import opencc_clib
    except ImportError:
        from opencc.clib import opencc_clib

if opencc_clib is not None:
    __version__ = opencc_clib.__version__
else:
    try:
        from opencc.opencc import OpenCC as _PureOpenCC
    except ImportError as exc:
        raise ImportError(
            'Pure Python backend is unavailable. Install optional dependency '
            '"opencc-python-reimplemented" or unset OPENCC_PURE_PYTHON.'
        ) from exc
    try:
        __version__ = metadata.version('opencc-python-reimplemented')
    except metadata.PackageNotFoundError:
        __version__ = 'dev'

if opencc_clib is None and os.path.isdir(os.path.join(_this_dir, 'config')):
    _pure_config_dir = os.path.join(_this_dir, 'config')
    CONFIGS = [f for f in os.listdir(_pure_config_dir) if f.endswith('.json')]
elif os.path.isdir(_opencc_share_dir):
    CONFIGS = [f for f in os.listdir(_opencc_share_dir) if f.endswith('.json')]
elif os.path.isdir(_opencc_configdir):
    CONFIGS = [f for f in os.listdir(_opencc_configdir) if f.endswith('.json')]
else:
    CONFIGS = []


if opencc_clib is not None:
    class OpenCC(opencc_clib._OpenCC):

        def __init__(self, config: str = 't2s') -> None:
            if not config.endswith('.json'):
                config += '.json'
            if not os.path.isfile(config):
                config_under_share_dir = os.path.join(_opencc_share_dir, config)
                if os.path.isfile(config_under_share_dir):
                    config = config_under_share_dir
            super().__init__(config)
            self.config = config

        def convert(self, text: str):
            byte_text = text.encode('utf-8')
            return super().convert(byte_text, len(byte_text))
else:
    class OpenCC:

        def __init__(self, config: str = 't2s') -> None:
            normalized = config[:-5] if config.endswith('.json') else config
            self._converter = _PureOpenCC(normalized)
            self.config = config if config.endswith('.json') else f'{config}.json'

        def convert(self, text: str):
            return self._converter.convert(text)
