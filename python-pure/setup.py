import os
import re

import setuptools

_this_dir = os.path.dirname(os.path.abspath(__file__))

_readme_files = (
    os.path.join(_this_dir, 'README.md'),
    os.path.join(_this_dir, 'README.zh-TW.md'),
)
OPENCC_DATA_VERSION = '1.4.1'


def _read_readme_for_pkg_info(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    content = re.sub(
        r'^\[(?:English version|繁體中文版)\]\([^)]+\)\n\n',
        '',
        content,
        flags=re.MULTILINE,
    )
    return re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content).strip()


def get_long_description():
    parts = [
        _read_readme_for_pkg_info(path)
        for path in _readme_files
        if os.path.isfile(path)
    ]
    return '\n\n---\n\n'.join(parts)


setuptools.setup(
    name='opencc-py',
    version=OPENCC_DATA_VERSION,
    author='OpenCC contributors',
    description='Conversion between Traditional and Simplified Chinese (pure Python)',
    long_description=get_long_description(),
    long_description_content_type='text/markdown',
    url='https://github.com/BYVoid/OpenCC',
    license='Apache-2.0',
    license_files=['LICENSE'],

    packages=['opencc'],
    package_dir={'opencc': 'opencc'},
    package_data={
        'opencc': ['py.typed'],
    },
    install_requires=[f'opencc-data=={OPENCC_DATA_VERSION}'],

    python_requires='>=3.9',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Intended Audience :: Science/Research',
        'Natural Language :: Chinese (Simplified)',
        'Natural Language :: Chinese (Traditional)',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Topic :: Scientific/Engineering',
        'Topic :: Software Development',
        'Topic :: Software Development :: Libraries',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Software Development :: Localization',
        'Topic :: Text Processing :: Linguistic',
        'Typing :: Typed',
    ],
    keywords=['opencc', 'convert', 'chinese'],
)
