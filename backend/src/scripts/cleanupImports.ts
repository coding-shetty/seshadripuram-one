import { cleanupImportPayloads } from '../services/importRetention';

async function main() {
  console.log('Starting import payload retention cleanup...');
  const result = await cleanupImportPayloads();
  console.log(`Cleanup complete: purged raw payload for ${result.purgedCount} import job(s).`);
  if (result.purgedJobIds.length > 0) {
    console.log(`Purged job IDs: ${result.purgedJobIds.join(', ')}`);
  }
}

main().catch((error) => {
  console.error('Failed to run import retention cleanup:', error);
  process.exit(1);
});
