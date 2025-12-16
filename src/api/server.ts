import Fastify from 'fastify';
import prisma from '../database/client.js'; // ../ is correct here (src/api -> src/database)
import { logger } from '../utils/logger.js'; // ../ is correct here (src/api -> src/utils)
import { startBot, stopBot, getStatus } from '../queue/scheduler.js';

export async function startServer() {
  const server = Fastify({ logger: false });

  // Control Endpoints
  server.post('/control/start', async () => {
    await startBot();
    return { status: 'started' };
  });

  server.post('/control/stop', async () => {
    await stopBot();
    return { status: 'stopped' };
  });

  server.get('/control/status', async () => {
    return getStatus();
  });

  // Data Endpoints
  server.get('/posts/:username', async (req) => {
    const { username } = req.params as { username: string };
    return prisma.post.findMany({ where: { author: username } });
  });

  try {
    const port = parseInt(process.env.PORT || '3000');
    await server.listen({ port, host: '0.0.0.0' });
    logger.info(`🎛️ API listening on http://0.0.0.0:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}