# GlassJS

![npm](https://img.shields.io/npm/v/@krazybean/glassjs)
![node](https://img.shields.io/badge/node-18%2B-blue)
![license](https://img.shields.io/badge/license-MIT-green)

Minimal observability for Node.js backends.

See what your app is doing without adopting a full observability stack.

`@krazybean/glassjs` gives you useful request visibility in minutes: request IDs, timing, structured logs, and request-scoped logging context.

## Why GlassJS

- Zero config: add one line, get immediate value.
- Lightweight: no dependencies, no agents, no dashboards.
- No vendor lock-in: plain JSON logs to stdout or your own logger.
- Practical defaults: request ID propagation, timing, context-aware app logs.

## Install

```bash
npm install @krazybean/glassjs
```

## 30-second quick start

```js
const express = require('express');
const { observe, log } = require('@krazybean/glassjs');

const app = express();

observe(app, { service: 'api' });

app.get('/health', (req, res) => {
  log('health check hit');
  res.status(200).json({ ok: true });
});

app.listen(3000);
```

## What you get out of the box

- `x-request-id` reuse/generation + response header propagation
- request duration and status logs
- request-scoped context (via AsyncLocalStorage)
- `log()`, `log.info()`, `log.error()`, etc.
- `log.child(bindings)` for module/service/component bindings
- lifecycle hooks: `onRequestStart`, `onRequestFinish`

## Example output

```json
{
  "level": "info",
  "event": "http_request",
  "time": "2026-01-01T00:00:00.000Z",
  "requestId": "f95f0c3f-77d8-4d2a-84bd-cdbef64656eb",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "durationMs": 1.032,
  "ip": "::1",
  "aborted": false,
  "service": "api"
}
```

## API at a glance

- `observe(app, options?)`
- `log(messageOrFields?, fields?)`
- `log.info/debug/warn/error(...)`
- `log.child(bindings)`
- `getRequestContext()`

## Full docs

For detailed examples and advanced usage, see [USAGE.md](/Users/juancastro/Documents/Github/glassjs/USAGE.md).

## Philosophy

- Lightweight > complete
- Zero config
- No vendor lock-in
- Useful immediately
