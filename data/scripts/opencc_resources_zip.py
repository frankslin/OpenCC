#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import subprocess
import time
import zipfile
from datetime import datetime, timezone


DEFAULT_SOURCE_URL = "https://github.com/BYVoid/OpenCC"
MANIFEST_NAME = "opencc-resource-manifest.json"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build an OpenCC share archive backed by text dictionaries."
    )
    parser.add_argument("--output", required=True)
    parser.add_argument("--configs", nargs="+", required=True)
    parser.add_argument("--dicts", nargs="+", required=True)
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--stable-status")
    parser.add_argument("--volatile-status")
    parser.add_argument(
        "--exclude-dict-subdirs",
        action="store_true",
        default=False,
        help="Skip dict files stored under a subdirectory (e.g. cngov/).",
    )
    return parser.parse_args()


def read_status_file(path):
    values = {}
    if not path:
        return values
    try:
        with open(path, encoding="utf-8") as file:
            for line in file:
                parts = line.rstrip("\n").split(" ", 1)
                if len(parts) == 2:
                    values[parts[0]] = parts[1]
    except FileNotFoundError:
        pass
    return values


def git_output(args):
    try:
        return subprocess.check_output(
            ["git", *args],
            encoding="utf-8",
            stderr=subprocess.DEVNULL,
        ).strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return ""


def first_value(values, keys):
    for key in keys:
        value = values.get(key)
        if value:
            return value
    return ""


def build_time_from_status(values):
    timestamp = values.get("BUILD_TIMESTAMP")
    if timestamp:
        try:
            return datetime.fromtimestamp(int(timestamp), timezone.utc).isoformat()
        except ValueError:
            pass
    return datetime.now(timezone.utc).isoformat()


def git_dirty():
    try:
        return (
            subprocess.call(["git", "diff", "--quiet"], stderr=subprocess.DEVNULL) != 0
            or subprocess.call(
                ["git", "diff", "--cached", "--quiet"], stderr=subprocess.DEVNULL
            )
            != 0
        )
    except FileNotFoundError:
        return False


def build_manifest(args, entries):
    stable_status = read_status_file(args.stable_status)
    volatile_status = read_status_file(args.volatile_status)
    status = {**stable_status, **volatile_status}
    source_url = first_value(
        status,
        [
            "STABLE_BUILD_SCM_REMOTE",
            "STABLE_GIT_REMOTE",
            "BUILD_SCM_REMOTE",
            "GIT_REMOTE",
        ],
    )
    if not source_url:
        source_url = git_output(["config", "--get", "remote.origin.url"])
    if not source_url:
        source_url = args.source_url

    commit_id = first_value(
        status,
        [
            "STABLE_BUILD_SCM_REVISION",
            "STABLE_GIT_COMMIT",
            "STABLE_BUILD_GIT_COMMIT",
            "BUILD_SCM_REVISION",
            "GIT_COMMIT",
        ],
    )
    if not commit_id:
        commit_id = git_output(["rev-parse", "HEAD"])

    dirty = status.get("STABLE_BUILD_SCM_DIRTY")
    if dirty not in ("0", "1"):
        dirty = "1" if git_dirty() else "0"

    return {
        "manifest_version": 1,
        "source_url": source_url,
        "commit_id": commit_id or "unknown",
        "source_dirty": dirty == "1",
        "build_time_utc": build_time_from_status(status),
        "hash_algorithm": "sha256",
        "entries": entries,
    }


def convert_dict_references(value):
    if isinstance(value, dict):
        converted = {}
        for key, child in value.items():
            if key == "type" and child == "ocd2":
                converted[key] = "text"
            elif key == "file" and isinstance(child, str) and child.endswith(".ocd2"):
                converted[key] = child[:-5] + ".txt"
            else:
                converted[key] = convert_dict_references(child)
        return converted
    if isinstance(value, list):
        return [convert_dict_references(child) for child in value]
    return value


def config_references_subdir_dict(value):
    """Return True if the config JSON references any dict file under a subdirectory."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "file" and isinstance(child, str) and "/" in child:
                return True
            if config_references_subdir_dict(child):
                return True
    elif isinstance(value, list):
        for item in value:
            if config_references_subdir_dict(item):
                return True
    return False


def read_text_config(path):
    with open(path, encoding="utf-8") as file:
        config = json.load(file)
    converted = convert_dict_references(config)
    return json.dumps(converted, ensure_ascii=False, indent=2) + "\n"


def read_clean_dictionary(path):
    cleaned = []
    with open(path, encoding="utf-8") as file:
        for line in file:
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cleaned.append(line)
    return "".join(cleaned)


def write_entry(archive, name, content, date_time):
    info = zipfile.ZipInfo(name)
    info.date_time = date_time
    info.compress_type = zipfile.ZIP_STORED
    info.external_attr = 0o644 << 16
    archive.writestr(info, content.encode("utf-8"))


def add_entry(archive, entries, name, content, date_time):
    if name in entries:
        return
    write_entry(archive, name, content, date_time)
    entries[name] = {
        "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "size": len(content.encode("utf-8")),
    }


def dict_zip_name(path):
    """Return the name for a dict file inside the zip archive.

    Preserves subdirectory components relative to the nearest 'dictionary'
    ancestor so that files in subdirectories (e.g. cngov/STCharacters.txt)
    are stored with their subpath and do not collide with top-level files
    of the same basename.
    """
    parts = path.replace("\\", "/").split("/")
    for i in range(len(parts) - 2, -1, -1):
        if parts[i] == "dictionary":
            return "/".join(parts[i + 1 :])
    return os.path.basename(path)


def main():
    args = parse_args()
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    date_time = time.localtime()[:6]
    with zipfile.ZipFile(args.output, "w") as archive:
        entries = {}
        for path in sorted(args.configs, key=os.path.basename):
            if args.exclude_dict_subdirs:
                with open(path, encoding="utf-8") as f:
                    raw_cfg = json.load(f)
                if config_references_subdir_dict(raw_cfg):
                    continue
            add_entry(
                archive,
                entries,
                os.path.basename(path),
                read_text_config(path),
                date_time,
            )
        for path in sorted(args.dicts, key=dict_zip_name):
            name = dict_zip_name(path)
            if args.exclude_dict_subdirs and "/" in name:
                continue
            add_entry(
                archive,
                entries,
                name,
                read_clean_dictionary(path),
                date_time,
            )
        manifest = json.dumps(
            build_manifest(args, entries),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ) + "\n"
        write_entry(archive, MANIFEST_NAME, manifest, date_time)


if __name__ == "__main__":
    main()
