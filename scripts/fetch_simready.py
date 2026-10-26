#!/usr/bin/env python3
"""
fetch_simready.py: Zero-cost selective downloader for NVIDIA SimReady 3D Assets.
Selectively fetches warehouse, reefer, pallet, and industrial equipment from
NVIDIA Hugging Face OpenUSD repositories without downloading the entire 472GB corpus.

Part of CrossRoute Smart Port Telematics & Digital Twin Architecture.
"""

import os
import sys
import json
import urllib.request
import argparse
from typing import List, Dict

HF_DATASET_BASE = "https://huggingface.co/datasets"
REPOS = {
    "warehouse": "nvidia/PhysicalAI-SimReady-Warehouse-01",
    "central": "nvidia/simready-central-library",
    "chillers": "TraneTechnologies/simready-assets",
    "scanned": "ALLSIDES/Industrial-Next-SimReady"
}

TARGET_PATTERNS = [
    "pallet", "rack", "container", "forklift", "chiller", "chassis", "plug"
]

def query_dataset_tree(repo_id: str, path: str = "") -> List[Dict]:
    """Fetch repository file tree via Hugging Face REST API."""
    url = f"https://huggingface.co/api/datasets/{repo_id}/tree/main/{path}".rstrip("/")
    req = urllib.request.Request(url, headers={"User-Agent": "CrossRoute-SimReady-Fetcher/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[WARN] Failed to query tree for {repo_id}: {e}")
        return []

def download_file(repo_id: str, file_path: str, output_dir: str):
    """Download a single file from Hugging Face dataset."""
    dest_path = os.path.join(output_dir, file_path)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    url = f"{HF_DATASET_BASE}/{repo_id}/resolve/main/{file_path}"
    print(f"[FETCH] Downloading: {file_path} -> {dest_path}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CrossRoute-SimReady-Fetcher/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(dest_path, "wb") as out_file:
            out_file.write(resp.read())
        print(f"[SUCCESS] Saved: {dest_path} ({os.path.getsize(dest_path):,} bytes)")
    except Exception as e:
        print(f"[ERROR] Failed to download {file_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Selective NVIDIA SimReady Asset Downloader")
    parser.add_argument("--repo", default="warehouse", choices=list(REPOS.keys()), help="Target dataset repository")
    parser.add_argument("--filter", nargs="+", default=TARGET_PATTERNS, help="Keyword filters")
    parser.add_argument("--dest", default="vendor/simready", help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="List matching files without downloading")
    args = parser.parse_args()

    repo_id = REPOS[args.repo]
    print(f"=== Scanning SimReady Dataset: {repo_id} ===")
    tree = query_dataset_tree(repo_id)
    
    matched_files = []
    for item in tree:
        path = item.get("path", "")
        if any(f.lower() in path.lower() for f in args.filter):
            matched_files.append(path)
            
    print(f"Found {len(matched_files)} matching candidate assets.")
    for f in matched_files:
        print(f"  - {f}")

    if not args.dry_run and matched_files:
        for f in matched_files:
            download_file(repo_id, f, args.dest)

if __name__ == "__main__":
    main()
