import os

import setuptools

_this_dir = os.path.dirname(os.path.abspath(__file__))

_readme_file = os.path.join(_this_dir, 'README.md')
OPENCC_DATA_VERSION = '1.3.2.dev20260628'


def get_long_description():
    if not os.path.isfile(_readme_file):
        return ''
    with open(_readme_file, encoding='utf-8') as f:
        return f.read()


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
