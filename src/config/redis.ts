import { ConnectionOptions } from 'bullmq';
import 'dotenv/config';

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};
