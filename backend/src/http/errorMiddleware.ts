import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logging';

export interface RequestWithId extends Request {
  requestId?: string;
}

export class HttpError extends Error {
  statusCode: number;
  exposeMessage: boolean;

  constructor(statusCode: number, message: string, exposeMessage = true) {
    super(message);
    this.statusCode = statusCode;
    this.exposeMessage = exposeMessage;
  }
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const headerId = req.headers['x-request-id'];
  const requestId =
    typeof headerId === 'string' && headerId.trim() !== ''
      ? headerId
      : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function errorMiddleware(
  err: unknown,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || randomUUID();

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, 'Request failed with server error');
    }
    res.status(err.statusCode).json({
      error: err.exposeMessage ? err.message : 'Internal server error',
      requestId,
    });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error', requestId });
}
