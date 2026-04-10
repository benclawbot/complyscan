#!/usr/bin/env python3
"""Workspace SQLite integrity checker.

Scans the workspace for SQLite files and runs `PRAGMA integrity_check`.
Exits non-zero if any database fails integrity validation.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".dropbox.cache", ".wrangler", "quarantine"}
DB_SUFFIXES = (".db", ".sqlite", ".sqlite3")


def should_skip(path: Path) -> bool:
    return any(part in SKIP_PARTS for part in path.parts)


def db_candidates(root: Path):
    for p in root.rglob("*"):
        if not p.is_file() or should_skip(p):
            continue
        if p.suffix in DB_SUFFIXES or p.name.endswith((".db-wal", ".db-shm")):
            yield p


def check_db(path: Path) -> tuple[bool, str]:
    if path.name.endswith((".db-wal", ".db-shm")):
        return True, "skip-sidecar"
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            row = conn.execute("PRAGMA integrity_check;").fetchone()
        finally:
            conn.close()
        result = (row[0] if row else "unknown").strip().lower()
        return (result == "ok"), result
    except Exception as exc:  # noqa: BLE001
        return False, f"error: {exc}"


def main() -> int:
    failures = []
    checked = 0
    for db in sorted(db_candidates(ROOT)):
        ok, detail = check_db(db)
        rel = db.relative_to(ROOT)
        if detail == "skip-sidecar":
            continue
        checked += 1
        status = "OK" if ok else "FAIL"
        print(f"[{status}] {rel} :: {detail}")
        if not ok:
            failures.append((rel, detail))

    print(f"\nChecked {checked} SQLite DB file(s).")
    if failures:
        print("Integrity failures detected:")
        for rel, detail in failures:
            print(f" - {rel}: {detail}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
