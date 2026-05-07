import os
from importlib import metadata

_this_dir = os.path.dirname(os.path.abspath(__file__))
_opencc_share_dir = os.path.join(_this_dir, 'clib', 'share', 'opencc')
_opencc_rootdir = os.path.abspath(os.path.join(_this_dir, '..', '..'))
_opencc_configdir = os.path.join(_opencc_rootdir, 'data', 'config')
_use_pure_mode = os.environ.get('OPENCC_PURE_PYTHON', '').lower() in ('1', 'true', 'yes')

__all__ = ['CONFIGS', 'OpenCC', '__version__']

opencc_clib = None
if not _use_pure_mode:
    try:
        import opencc_clib
    except ImportError:
        try:
            from opencc.clib import opencc_clib
        except ImportError:
            opencc_clib = None

if opencc_clib is not None:
    __version__ = opencc_clib.__version__
else:
    from opencc._opencc_pure import OpenCC as _PureOpenCC
    from opencc._opencc_pure import list_configs as _list_pure_configs
    try:
        __version__ = metadata.version('OpenCC')
    except metadata.PackageNotFoundError:
        __version__ = 'dev'


def _discover_configs():
    if opencc_clib is None:
        return _list_pure_configs()

    if os.path.isdir(_opencc_share_dir):
        return [f for f in os.listdir(_opencc_share_dir) if f.endswith('.json')]
    if os.path.isdir(_opencc_configdir):
        return [f for f in os.listdir(_opencc_configdir) if f.endswith('.json')]
    return []


CONFIGS = _discover_configs()


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
            self._impl = _PureOpenCC(config)
            self.config = config if config.endswith('.json') else f'{config}.json'

        def convert(self, text: str) -> str:
            return self._impl.convert(text)
