'use strict';

const express = require('express');
const { observe, log, getRequestContext } = require('@krazybean/glassjs');

const app = express();
const port = Number(process.env.PORT || 3000);

observe(app, {
  service: 'glassjs-dev-server',
  hooks: {
    onRequestStart({ requestId, context }) {
      log.debug('request:start', {
        requestId,
        method: context.method,
        path: context.path,
      });
    },
    onRequestFinish({ requestId, entry }) {
      log.debug('request:finish', {
        requestId,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        aborted: entry.aborted,
      });
    },
  },
});

const routeLog = log.child({ area: 'routes' });

app.get('/', (req, res) => {
  log('hello from shorthand log()');
  res.json({ ok: true, route: '/' });
});

app.get('/child', (req, res) => {
  const authLog = routeLog.child({ module: 'auth' });
  authLog.info('child logger hit', { action: 'token-check' });
  res.json({ ok: true, route: '/child' });
});

app.get('/async', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  log.info('async route completed', { phase: 'after-timeout' });
  res.json({ ok: true, route: '/async' });
});

app.get('/context', (req, res) => {
  const context = getRequestContext();
  log.info('context read', { hasContext: Boolean(context) });
  res.json({ ok: true, route: '/context', context });
});

app.get('/error', (req, res) => {
  log.error('simulated error path', { reason: 'manual-test' });
  res.status(500).json({ ok: false, route: '/error' });
});

app.get('/slow', (req, res) => {
  setTimeout(() => {
    log.warn('slow route responded', { delayMs: 300 });
    res.json({ ok: true, route: '/slow', delayMs: 300 });
  }, 300);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`glassjs dev server running at http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log('Try: /, /child, /async, /context, /error, /slow');
});
