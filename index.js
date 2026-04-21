'use strict';

const { randomUUID } = require('node:crypto');
const {
  runWithRequestContext,
  getRequestContext,
} = require('./src/context');
const { log, setLogWriter } = require('./src/log');

const DEFAULT_REQUEST_ID_HEADER = 'x-request-id';

function observe(app, options = {}) {
  if (!app || typeof app.use !== 'function') {
    throw new TypeError('observe(app) expects an app with a .use(middleware) function');
  }

  app.use(createMiddleware(options));
  return app;
}

function createMiddleware(options = {}) {
  const {
    logger = defaultLogger,
    requestIdHeader = DEFAULT_REQUEST_ID_HEADER,
    service,
    skip,
    hooks = {},
    now = () => Date.now(),
  } = options;

  setLogWriter(logger);

  const normalizedHeader = String(requestIdHeader).toLowerCase();

  return function glassObserveMiddleware(req, res, next) {
    if (typeof skip === 'function' && skip(req)) {
      return callNext(next);
    }

    const startedAt = process.hrtime.bigint();
    const requestId = getOrCreateRequestId(req, normalizedHeader);
    const requestContext = createRequestContext({ req, requestId, service });
    const startTime = now();

    safeSetHeader(res, normalizedHeader, requestId);
    callHook(hooks.onRequestStart, {
      req,
      res,
      requestId,
      context: requestContext,
      time: new Date(startTime).toISOString(),
    });

    const onFinish = () => {
      cleanup();
      runWithRequestContext(requestContext, () => {
        const entry = createLogEntry({
          req,
          res,
          requestId,
          startedAt,
          now,
          service,
          aborted: false,
        });
        writeLog({
          logger,
          entry,
        });
        callHook(hooks.onRequestFinish, {
          req,
          res,
          requestId,
          context: requestContext,
          entry,
        });
      });
    };

    const onClose = () => {
      if (res.writableEnded) {
        return;
      }

      cleanup();
      runWithRequestContext(requestContext, () => {
        const entry = createLogEntry({
          req,
          res,
          requestId,
          startedAt,
          now,
          service,
          aborted: true,
        });
        writeLog({
          logger,
          entry,
        });
        callHook(hooks.onRequestFinish, {
          req,
          res,
          requestId,
          context: requestContext,
          entry,
        });
      });
    };

    const cleanup = () => {
      res.removeListener('finish', onFinish);
      res.removeListener('close', onClose);
    };

    res.once('finish', onFinish);
    res.once('close', onClose);

    return runWithRequestContext(requestContext, () => callNext(next));
  };
}

function callHook(hook, payload) {
  if (typeof hook !== 'function') {
    return;
  }

  try {
    hook(payload);
  } catch {
    // no-op: hooks should not break request handling
  }
}

function createLogEntry({ req, res, requestId, startedAt, now, service, aborted }) {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  const entry = {
    level: 'info',
    event: 'http_request',
    time: new Date(now()).toISOString(),
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: res.statusCode,
    durationMs: Number(durationMs.toFixed(3)),
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers ? req.headers['user-agent'] : undefined,
    contentLength: parseContentLength(res),
    aborted,
  };

  if (service) {
    entry.service = service;
  }

  return entry;
}

function parseContentLength(res) {
  if (!res || typeof res.getHeader !== 'function') {
    return undefined;
  }

  const value = res.getHeader('content-length');
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getOrCreateRequestId(req, header) {
  const headers = req && req.headers ? req.headers : {};
  const existing = headers[header];

  if (Array.isArray(existing)) {
    return String(existing[0]);
  }

  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  return randomUUID();
}

function createRequestContext({ req, requestId, service }) {
  const context = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.socket?.remoteAddress,
  };

  if (service) {
    context.service = service;
  }

  return context;
}

function safeSetHeader(res, header, value) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }

  if (typeof res.getHeader === 'function' && res.getHeader(header)) {
    return;
  }

  try {
    res.setHeader(header, value);
  } catch {
    // no-op: response may already be committed
  }
}

function callNext(next) {
  if (typeof next === 'function') {
    return next();
  }

  return undefined;
}

function writeLog({ logger, entry }) {
  try {
    logger(entry);
  } catch {
    // no-op: observability should not break request handling
  }
}

function defaultLogger(entry) {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = {
  observe,
  createMiddleware,
  log,
  getRequestContext,
};
