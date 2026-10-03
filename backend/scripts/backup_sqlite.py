#!/usr/bin/env python3
"""Online SQLite backup/restore to a NEW file; never overwrites a database.

For local SQLite deployments only. Remote libSQL requires a provider export.
Backups contain personal data: keep them encrypted and outside Git.
"""
import argparse
import os
from pathlib import Path
import sqlite3


def copy_database(source: Path, destination: Path) -> None:
    source = source.resolve(strict=True)
    destination = destination.absolute()
    if source == destination.resolve():
        raise ValueError("Source and destination must be different")
    # Exclusive creation prevents accidental overwrite (including symlinks).
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
    try:
        with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
            with sqlite3.connect(destination) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise ValueError('SQLite integrity check failed')
                if dst.execute('PRAGMA foreign_key_check').fetchone() is not None:
                    raise ValueError('Foreign key check failed; investigate source data')
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['backup', 'restore'])
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path, help='New file only; parent directory must already exist')
    args = parser.parse_args()
    copy_database(args.source, args.destination)
    print(f'{args.operation.capitalize()} completed and integrity verified. No existing database was overwritten.')


if __name__ == '__main__':
    main()
