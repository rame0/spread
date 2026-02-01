import express from 'express';
import cors from 'cors';
import authRouter from './http/authRouter';
import cardsRouter from './http/cardsRouter';
import { config } from './config/env';
import { pingDb, runMigrations } from './db';
import { httpLogger, logger } from './logging';

const app = express();

app.use(cors());
app.use(express.json());
app.use(httpLogger);

app.get('/health', async (_req, res) => {
  const dbOk = await pingDb();
  const payload = {
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'fail',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  if (!dbOk) {
    res.status(503).json(payload);
    return;
  }
  res.status(200).json(payload);
});

app.use('/api/auth', authRouter);
app.use('/api/cards', cardsRouter);

async function start() {
  try {
    await runMigrations();
  } catch (e) {
    logger.warn({ err: e }, 'Migrations (optional) failed');
  }
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server running');
  });
}

start();
