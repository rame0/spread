import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './config/env';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
});

export const httpLogger = pinoHttp({
  logger,
});
