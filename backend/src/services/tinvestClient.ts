/**
 * T-Bank Invest API over its REST gateway. The API certificate is issued by the Russian
 * Trusted Root CA, which Node does not trust; that root is added for this host only.
 */
import { readFileSync } from 'fs';
import { request } from 'https';
import { resolve } from 'path';
import { rootCertificates } from 'tls';
import type { TinvestAccount, TinvestPortfolioResponse } from '../domain/tinvest';

const HOST = 'invest-public-api.tbank.ru';
const BASE_PATH = '/rest/tinkoff.public.invest.api.contract.v1';
const TIMEOUT_MS = 15000;

let ca: string[] | null = null;
function trustedCas(): string[] {
  ca ??= [...rootCertificates, readFileSync(resolve(__dirname, '../../certs/russian_trusted_root_ca.cer'), 'utf8')];
  return ca;
}

export class TinvestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function call<T>(token: string, method: string, body: object): Promise<T> {
  const payload = JSON.stringify(body);
  return new Promise((resolvePromise, reject) => {
    const req = request(
      {
        host: HOST,
        path: `${BASE_PATH}.${method}`,
        method: 'POST',
        ca: trustedCas(),
        timeout: TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            // Error bodies carry a code and a message, never the token.
            let message = `T-Bank responded with ${res.statusCode}`;
            try {
              const parsed = JSON.parse(text) as { message?: string; description?: string };
              message = parsed.description || parsed.message || message;
            } catch {
              // keep the status message
            }
            reject(new TinvestError(message, res.statusCode));
            return;
          }
          try {
            resolvePromise(JSON.parse(text) as T);
          } catch {
            reject(new TinvestError('Invalid response from T-Bank'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new TinvestError('T-Bank did not respond in time')));
    req.on('error', (error) => reject(error instanceof TinvestError ? error : new TinvestError(error.message)));
    req.end(payload);
  });
}

export async function getTinvestAccounts(token: string): Promise<TinvestAccount[]> {
  const response = await call<{ accounts?: TinvestAccount[] }>(token, 'UsersService/GetAccounts', {});
  return response.accounts ?? [];
}

export function getTinvestPortfolio(token: string, accountId: string): Promise<TinvestPortfolioResponse> {
  return call<TinvestPortfolioResponse>(token, 'OperationsService/GetPortfolio', { accountId, currency: 'RUB' });
}
