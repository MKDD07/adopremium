#!/usr/bin/env python3
"""
Sync Location Manifest
----------------------
Scans assets/data/location/*.json and updates assets/data/location/index.json
so all newly added villa JSON files are automatically indexed and detected.
"""

import os
import json
import glob

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOC_DIR = os.path.join(BASE_DIR, "assets", "data", "location")

def sync_manifest():
    if not os.path.exists(LOC_DIR):
        print(f"Directory not found: {LOC_DIR}")
        return

    json_files = []
    for fp in glob.glob(os.path.join(LOC_DIR, "*.json")):
        fn = os.path.basename(fp)
        if fn != "index.json":
            json_files.append(fn)

    json_files.sort()
    index_path = os.path.join(LOC_DIR, "index.json")
    with open(index_path, "w") as f:
        json.dump(json_files, f, indent=2)

    print(f"Updated {index_path} with {len(json_files)} file(s): {json_files}")

if __name__ == "__main__":
    sync_manifest()
