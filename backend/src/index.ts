import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRouter from './http/authRouter';
import cardsRouter from './http/cardsRouter';
import dashboardRouter from './http/dashboardRouter';
import mortgagesRouter from './http/mortgagesRouter';
import accountsRouter from './http/accountsRouter';
import integrationsRouter from './http/integrationsRouter';
import planRouter from './http/planRouter';
import { SYNC_INTERVAL_MS, syncAll } from './services/tinvestService';
import { errorMiddleware, requestIdMiddleware } from './http/errorMiddleware';
import { config } from './config/env';
import { pingDb, runMigrations } from './db';
import { httpLogger, logger } from './logging';

const app = express();

app.set('trust proxy', 1);

const globalLimiter = rateLimit({
  windowMs: config.globalRateLimitWindowMs,
  max: config.globalRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: config.globalRateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const corsAllowAll = config.corsOrigins.includes('*');

app.use(helmet());
app.use(globalLimiter);
app.use(requestIdMiddleware);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsAllowAll || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin denied'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(cookieParser());
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

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/mortgages', mortgagesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/plan', planRouter);
app.use(errorMiddleware);

async function start() {
  try {
    await runMigrations();
  } catch (e) {
    logger.warn({ err: e }, 'Migrations (optional) failed');
  }
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server running');
  });
  if (config.nodeEnv !== 'test') {
    const runSync = () => syncAll().catch((error) => logger.warn({ err: error }, 'T-Bank sync failed'));
    setTimeout(runSync, 30_000);
    setInterval(runSync, SYNC_INTERVAL_MS).unref();
  }
}

start();
