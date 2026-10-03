import path from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, closeDatabase } from '../db';

// Runtime migration path works from both tsx source and the compiled dist tree.
// Compiled deployments must include src/db/migrations (see Dockerfile).
migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'src/db/migrations') })
  .then(() => console.info('Database migrations applied'))
  .catch(() => { console.error('Migration failed. Check database access and migration state.'); process.exitCode = 1; })
  .finally(closeDatabase);
