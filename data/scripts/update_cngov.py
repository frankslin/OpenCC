#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import sys
from pathlib import Path


TEXT_FILES = [
    "GovVariants.txt",
    "GovVariants_keep_simp.txt",
    "STCharacters.txt",
    "STPhrases.txt",
    "TGCharacters.txt",
    "TGCharacters_keep_simp.txt",
    "TGPhrases.txt",
    "TSCharacters.txt",
    "TSPhrases.txt",
]

CONFIG_MAP = {
    "s2t.json": ("data/config", "s2t_cngov.json"),
    "t2gov.json": ("data/config", "t2cngov.json"),
    "t2gov_jieba.json": ("plugins/jieba/data/config", "t2cngov_jieba.json"),
    "t2gov_keep_simp.json": ("data/config", "t2cngov_keep_simp.json"),
    "t2gov_keep_simp_jieba.json": (
        "plugins/jieba/data/config",
        "t2cngov_keep_simp_jieba.json",
    ),
    "t2s.json": ("data/config", "t2s_cngov.json"),
}

LOCAL_METADATA_KEYS = {
    "author",
    "license",
    "source",
    "contributors",
    "reference",
    "description",
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def read_bytes(path: Path):
    return path.read_bytes() if path.exists() else None


def write_if_changed(path: Path, content: bytes, dry_run: bool, label: str):
    current = read_bytes(path)
    if current == content:
        print(f"UNCHANGED {label}")
        return False
    print(f"UPDATED   {label}")
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    return True


def rewrite_dict_refs(node):
    if isinstance(node, dict):
        out = {}
        for key, value in node.items():
            out[key] = rewrite_dict_refs(value)
        if out.get("type") == "text":
            out["type"] = "ocd2"
        if isinstance(out.get("file"), str) and out["file"].endswith(".txt"):
            out["file"] = "cngov/" + out["file"][:-4] + ".ocd2"
        if out.get("user_dict_path") == "jieba_dict/user.dict.traditional.utf8":
            out["user_dict_path"] = "jieba_dict/user.dict.utf8"
        return out
    if isinstance(node, list):
        return [rewrite_dict_refs(item) for item in node]
    return node


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def merge_local_metadata(candidate, local):
    if not isinstance(candidate, dict) or not isinstance(local, dict):
        return candidate
    merged = dict(candidate)
    for key in LOCAL_METADATA_KEYS:
        if key in local:
            merged[key] = local[key]
    return merged


def substantive_view(obj):
    if not isinstance(obj, dict):
        return obj
    return {k: v for k, v in obj.items() if k not in LOCAL_METADATA_KEYS}


def strip_local_metadata(candidate):
    if not isinstance(candidate, dict):
        return candidate
    return {k: v for k, v in candidate.items() if k not in LOCAL_METADATA_KEYS}


def json_bytes(obj) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sync_texts(src_dir: Path, dst_dir: Path, dry_run: bool):
    print("[dictionary]")
    changed = 0
    for name in TEXT_FILES:
        src = src_dir / name
        dst = dst_dir / name
        if not src.exists():
            raise FileNotFoundError(f"Missing upstream dictionary: {src}")
        if write_if_changed(dst, src.read_bytes(), dry_run, f"data/dictionary/cngov/{name}"):
            changed += 1
    return changed


def sync_configs(src_dir: Path, root: Path, dry_run: bool):
    print("[config]")
    changed = 0
    for src_name, (dst_relative_dir, dst_name) in CONFIG_MAP.items():
        src = src_dir / src_name
        dst = root / dst_relative_dir / dst_name
        if not src.exists():
            raise FileNotFoundError(f"Missing upstream config: {src}")

        upstream = load_json(src)
        candidate = strip_local_metadata(rewrite_dict_refs(upstream))

        local = load_json(dst) if dst.exists() else None
        if local is not None:
            substantive_changed = substantive_view(local) != substantive_view(candidate)
        else:
            substantive_changed = True

        current_bytes = read_bytes(dst)
        new_bytes = json_bytes(candidate)
        if current_bytes == new_bytes:
            suffix = " (substantive)" if substantive_changed else ""
            print(f"UNCHANGED {dst_relative_dir}/{dst_name}{suffix}")
            continue
        if not substantive_changed:
            print(f"UNCHANGED {dst_relative_dir}/{dst_name} (metadata/format only)")
            continue

        print(f"UPDATED   {dst_relative_dir}/{dst_name} (substantive)")
        if not dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(new_bytes)
        changed += 1
    return changed


def main():
    parser = argparse.ArgumentParser(
        description="Sync CN Government Standard dictionaries/configs from deps/cngov."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned updates without writing files.",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=None,
        help="Override source directory (default: deps/cngov/t2gov).",
    )
    args = parser.parse_args()

    root = repo_root()
    src_dir = args.source_dir or (root / "deps" / "cngov" / "t2gov")
    dict_dir = root / "data" / "dictionary" / "cngov"

    if not src_dir.exists():
        print(f"Source directory not found: {src_dir}", file=sys.stderr)
        return 1

    dict_changed = sync_texts(src_dir, dict_dir, args.dry_run)
    config_changed = sync_configs(src_dir, root, args.dry_run)

    print(
        f"Done. dictionary_changed={dict_changed} config_changed={config_changed} "
        f"dry_run={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
