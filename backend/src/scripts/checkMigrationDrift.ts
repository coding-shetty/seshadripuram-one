import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export function checkMigrationDrift(): { driftDetected: boolean; newMigrations: string[] } {
  // 1. Check if drizzle-kit supports a native --check flag
  try {
    const helpOutput = execSync('npx drizzle-kit generate --help', { encoding: 'utf-8' });
    if (helpOutput.includes('--check')) {
      console.log('Using native drizzle-kit generate --check flag...');
      execSync('npx drizzle-kit generate --check', { stdio: 'inherit' });
      return { driftDetected: false, newMigrations: [] };
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback: Generate into temporary location and fail if any new SQL migration is produced
  const tmpOutDir = './tmp-migration-drift-check';
  const migrationsDir = path.resolve(process.cwd(), './src/db/migrations');

  try {
    if (fs.existsSync(tmpOutDir)) {
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }

    fs.cpSync(migrationsDir, tmpOutDir, { recursive: true });

    const initialFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

    execSync(
      `npx drizzle-kit generate --dialect sqlite --schema src/db/schema.ts --out "${tmpOutDir}"`,
      {
        stdio: 'pipe',
        encoding: 'utf-8',
      }
    );

    const generatedFiles = fs.readdirSync(tmpOutDir).filter((f) => f.endsWith('.sql'));
    const newMigrations = generatedFiles.filter((f) => !initialFiles.includes(f));

    if (newMigrations.length > 0) {
      return { driftDetected: true, newMigrations };
    }

    return { driftDetected: false, newMigrations: [] };
  } finally {
    if (fs.existsSync(tmpOutDir)) {
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  console.log('Checking for database migration drift between schema.ts and src/db/migrations...');
  const result = checkMigrationDrift();
  if (result.driftDetected) {
    console.error('❌ MIGRATION DRIFT DETECTED:');
    console.error(`schema.ts contains unmigrated schema changes that generated: ${result.newMigrations.join(', ')}`);
    console.error("Please run 'npm run db:generate' and commit the generated migration files.");
    process.exit(1);
  } else {
    console.log('✅ Migrations are completely in sync with schema.ts. Zero drift detected.');
    process.exit(0);
  }
}
