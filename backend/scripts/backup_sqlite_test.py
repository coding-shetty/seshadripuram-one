import sqlite3
import tempfile
import unittest
from pathlib import Path
from backup_sqlite import copy_database


class BackupTests(unittest.TestCase):
    def test_backup_restore_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, backup, restored = [root / name for name in ('source.db', 'backup.db', 'restored.db')]
            with sqlite3.connect(source) as db:
                db.execute('CREATE TABLE example (id INTEGER PRIMARY KEY, value TEXT)')
                db.execute('INSERT INTO example VALUES (1, ?)', ('sample data',))
            copy_database(source, backup)
            copy_database(backup, restored)
            with sqlite3.connect(restored) as db:
                self.assertEqual(db.execute('SELECT value FROM example').fetchone(), ('sample data',))
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                copy_database(source, restored)

    def test_corruption_does_not_leave_a_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, backup = root / 'bad.db', root / 'backup.db'
            source.write_text('not a database')
            with self.assertRaises(sqlite3.DatabaseError):
                copy_database(source, backup)
            self.assertFalse(backup.exists())

    def test_missing_source_never_creates_database(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(FileNotFoundError):
                copy_database(root / 'missing.db', root / 'backup.db')
            self.assertEqual(list(root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
