import express from 'express';
import cors from 'cors';
import cardsRouter from './http/cardsRouter';
import { config } from './config/env';
import { runMigrations } from './db';
import { ensureDefaultUser } from './repositories/userRepository';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/cards', cardsRouter);

async function start() {
  try {
    await runMigrations();
  } catch (e) {
    console.warn('Migrations (optional):', (e as Error).message);
  }
  try {
    await ensureDefaultUser();
  } catch (e) {
    console.warn('Default user init (optional):', (e as Error).message);
  }
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start();
