/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ObserveLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event?: 'http_request';
  time: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  contentLength?: number;
  aborted?: boolean;
  service?: string;
  message?: string;
  [key: string]: unknown;
}

export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  ip?: string;
  service?: string;
  [key: string]: unknown;
}

export interface ObserveOptions {
  logger?: (entry: ObserveLogEntry | Record<string, unknown>) => void;
  requestIdHeader?: string;
  service?: string;
  skip?: (req: IncomingMessage) => boolean;
  hooks?: ObserveHooks;
  now?: () => number;
}

export interface MiddlewareApp {
  use: (
    middleware: (
      req: IncomingMessage,
      res: ServerResponse,
      next?: () => void
    ) => void
  ) => void;
}

export declare function observe<T extends MiddlewareApp>(app: T, options?: ObserveOptions): T;

export declare function createMiddleware(
  options?: ObserveOptions
): (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

export interface ObserveHookPayload {
  req: IncomingMessage;
  res: ServerResponse;
  requestId: string;
  context: RequestContext;
  time?: string;
  entry?: ObserveLogEntry;
}

export interface ObserveHooks {
  onRequestStart?: (payload: ObserveHookPayload) => void;
  onRequestFinish?: (payload: ObserveHookPayload) => void;
}

export interface RequestScopedLogger {
  (messageOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>): void;
  debug(messageOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>): void;
  info(messageOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>): void;
  warn(messageOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>): void;
  error(messageOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): RequestScopedLogger;
}

export declare const log: RequestScopedLogger;

export declare function getRequestContext(): RequestContext | null;
