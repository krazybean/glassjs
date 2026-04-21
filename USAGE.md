# GlassJS Usage Guide

This guide covers everything available in `@krazybean/glassjs`.

## Table of contents

1. Install
2. Quick start
3. Core concepts
4. API reference
5. Patterns
6. Hook recipes
7. Notes and behavior details

## 1. Install

```bash
npm install @krazybean/glassjs
```

## 2. Quick start

```js
const express = require('express');
const { observe, log } = require('@krazybean/glassjs');

const app = express();

observe(app, { service: 'billing-api' });

app.get('/invoices/:id', (req, res) => {
  log('fetch invoice', { invoiceId: req.params.id });
  res.json({ ok: true });
});

app.listen(3000);
```

## 3. Core concepts

- `observe(app)` installs middleware that tracks request lifecycle.
- Each request gets a request ID (`x-request-id`).
- Request completion emits a structured `http_request` log event.
- During request handling, `log.*` automatically includes request metadata from AsyncLocalStorage.

## 4. API reference

### `observe(app, options?)`

Installs middleware using `app.use(middleware)` and returns `app`.

```js
observe(app, {
  service: 'api',
  requestIdHeader: 'x-correlation-id',
  skip: (req) => req.url === '/healthz',
  logger: (entry) => process.stdout.write(JSON.stringify(entry) + '\n'),
});
```

#### `options.logger(entry)`

Custom log sink. Default writes JSON lines to stdout.

#### `options.requestIdHeader`

Header used for request ID propagation. Default: `x-request-id`.

#### `options.service`

Adds `service` field to request context and request logs.

#### `options.skip(req)`

If `true`, skips middleware logging for that request.

#### `options.now()`

Custom time source for request logs. Useful for deterministic tests.

#### `options.hooks`

Lifecycle hooks:

- `onRequestStart(payload)`
- `onRequestFinish(payload)`

Payload includes:

- `req`
- `res`
- `requestId`
- `context`
- `time` (start hook)
- `entry` (finish hook)

Example:

```js
observe(app, {
  hooks: {
    onRequestStart({ requestId, context, time }) {
      log.info('request started', { requestId, time, path: context.path });
    },
    onRequestFinish({ requestId, entry }) {
      if (entry.statusCode >= 500) {
        log.error('request failed', { requestId, statusCode: entry.statusCode });
      }
    },
  },
});
```

### `log(messageOrFields?, fields?)`

Shorthand for `log.info(...)`.

```js
log('checkout started', { cartId: 'c_123' });
```

### `log.info/debug/warn/error(...)`

Structured logger methods.

```js
log.info('user login', { userId: 'u_1' });
log.warn('rate limit near threshold', { key: 'org_12' });
log.error('db timeout', { retryable: true });
```

### `log.child(bindings)`

Creates a child logger with static bindings.

```js
const authLog = log.child({ module: 'auth', component: 'jwt' });

authLog.info('token validated', { userId: 'u_123' });
```

You can nest children:

```js
const appLog = log.child({ service: 'api' });
const workerLog = appLog.child({ module: 'invoice-worker' });
workerLog.info('job picked', { jobId: 'j_1' });
```

### `getRequestContext()`

Returns current request context or `null` outside request lifecycle.

```js
const { getRequestContext } = require('@krazybean/glassjs');

const ctx = getRequestContext();
if (ctx) {
  log.info('context available', { requestId: ctx.requestId });
}
```

## 5. Patterns

### Pattern: skip noisy endpoints

```js
observe(app, {
  skip: (req) => req.url === '/healthz' || req.url === '/readyz',
});
```

### Pattern: route-level child logger

```js
app.get('/users/:id', (req, res) => {
  const routeLog = log.child({ route: 'GET /users/:id' });
  routeLog.info('handler start', { userId: req.params.id });
  res.json({ ok: true });
});
```

### Pattern: custom transport

```js
observe(app, {
  logger(entry) {
    // Send to your preferred log pipeline
    process.stdout.write(JSON.stringify(entry) + '\n');
  },
});
```

### Pattern: custom request ID header

```js
observe(app, {
  requestIdHeader: 'x-correlation-id',
});
```

## 6. Hook recipes

### Capture latency SLO breaches

```js
observe(app, {
  hooks: {
    onRequestFinish({ entry }) {
      if (entry.durationMs > 300) {
        log.warn('latency threshold exceeded', {
          durationMs: entry.durationMs,
          path: entry.path,
          statusCode: entry.statusCode,
        });
      }
    },
  },
});
```

### Add one-time start markers

```js
observe(app, {
  hooks: {
    onRequestStart({ requestId, context }) {
      log.debug('request begin', { requestId, method: context.method, path: context.path });
    },
  },
});
```

## 7. Notes and behavior details

- Zero runtime dependencies.
- Existing request ID header value is reused when present.
- If missing, GlassJS generates a UUID and sets the response header.
- Logs are plain objects; no enforced schema beyond built-in fields.
- Per-call fields override child bindings, and child bindings override request context.
- Hook failures are swallowed so request handling is not interrupted.
