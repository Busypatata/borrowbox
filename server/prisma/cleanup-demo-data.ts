/**
 * Usage (from the repo root):
 *   npm run db:cleanup-demo                       # DRY RUN: shows what would be removed
 *   npm run db:cleanup-demo -- --apply            # actually remove it
 * Flags: --remove-admin (also remove the old demo admin admin@borrowbox.test)
 *        --include-real-dependents (also remove real members' records that point at demo records)
 */
import { prisma } from '../src/config/prisma';
import { cleanupDemoData } from '../src/maintenance/cleanupDemo';

const args = new Set(process.argv.slice(2));
const report = await cleanupDemoData(prisma, {
  apply: args.has('--apply'), removeAdmin: args.has('--remove-admin'), includeRealDependents: args.has('--include-real-dependents'),
});
console.log(JSON.stringify(report, null, 2));
if (report.blocked) { console.error(`\nNOT APPLIED: ${report.blocked}`); process.exitCode = 2; }
else if (!args.has('--apply')) console.log('\nDRY RUN — nothing was changed. Re-run with --apply to remove the records above.');
else console.log('\nDemo data removed.');
await prisma.$disconnect();
