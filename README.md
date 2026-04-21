# GlassJS

Minimal observability for Node.js backends.

Better than console.log — without the weight of full observability stacks.

![npm](https://img.shields.io/npm/v/@krazybean/glassjs)
![node](https://img.shields.io/badge/node-18%2B-blue)
![license](https://img.shields.io/badge/license-MIT-green)

## Why developers adopt it

- One line to enable request visibility
- Request IDs + timing out of the box
- Structured JSON logs for real systems
- Request-scoped context via AsyncLocalStorage
- Zero dependencies, zero vendor lock-in

## Install

```bash
npm install @krazybean/glassjs
```

## 30-second setup

```js
const express = require('express');
const { observe, log } = require('@krazybean/glassjs');

const app = express();

observe(app, { service: 'api' });

app.get('/health', (req, res) => {
  log('health check');
  res.json({ ok: true });
});

app.listen(3000);
```

## What you get immediately

- Automatic `x-request-id` propagation
- Request completion logs (`statusCode`, `durationMs`, `path`, `method`)
- Context-aware app logs (`log.info`, `log.error`) inside requests

Example request log:

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
  "aborted": false,
  "service": "api"
}
```

## API (quick glance)

- `observe(app, options?)`
- `log(messageOrFields?, fields?)`
- `log.info/debug/warn/error(...)`
- `log.child(bindings)`
- `getRequestContext()`

## Common real-world patterns

```js
// Skip noisy routes
observe(app, {
  skip: (req) => req.url === '/healthz',
});

// Child logger for module-level fields
const authLog = log.child({ module: 'auth' });
authLog.info('token validated', { userId: 'u_123' });

// Lifecycle hooks
observe(app, {
  hooks: {
    onRequestStart({ requestId }) {
      log.debug('request started', { requestId });
    },
    onRequestFinish({ entry }) {
      if (entry.statusCode >= 500) log.error('request failed', { statusCode: entry.statusCode });
    },
  },
});
```

## Philosophy

- Lightweight > complete
- Zero config
- No vendor lock-in
- Useful immediately

## Full usage guide

See [USAGE.md](/Users/juancastro/Documents/Github/glassjs/USAGE.md) for complete examples and option details.
