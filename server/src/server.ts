import { createApp } from './app';
import { prisma } from './config/prisma';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`BorrowBox API listening on :${env.PORT} (${env.NODE_ENV})`);
  if (!env.smtpConfigured) logger.warn('SMTP not configured — emails are not delivered (logged in development only).');
  if (!env.cloudinaryConfigured && env.STORAGE_PROVIDER === 'cloudinary') {
    logger.warn('Cloudinary not configured — image uploads are disabled.');
  }
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
