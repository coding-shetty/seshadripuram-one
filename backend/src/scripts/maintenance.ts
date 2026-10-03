import { runMaintenance } from '../services/maintenance';
import { closeDatabase } from '../db';
import { logger } from '../utils/logger';

runMaintenance().catch(() => {
  logger.error({ event: 'maintenance_failed' });
  process.exitCode = 1;
}).finally(closeDatabase);
