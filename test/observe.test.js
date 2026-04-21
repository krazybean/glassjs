'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { observe, log, getRequestContext } = require('../index');

function createApp() {
  const app = {
    _middleware: null,
    use(fn) {
      this._middleware = fn;
    },
  };

  return app;
}

function request(server, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        port: server.address().port,
        method: 'GET',
        path: '/health?ready=true',
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

test('observe(app) installs middleware and logs requests', async () => {
  const app = createApp();
  const entries = [];

  observe(app, {
    logger: (entry) => entries.push(entry),
    service: 'unit-test-service',
    now: () => Date.UTC(2026, 0, 1, 0, 0, 0),
  });

  assert.equal(typeof app._middleware, 'function');

  const server = http.createServer((req, res) => {
    app._middleware(req, res, () => {
      res.statusCode = 204;
      res.end();
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server);
    assert.equal(res.statusCode, 204);

    assert.equal(entries.length, 1);
    const [entry] = entries;

    assert.equal(entry.event, 'http_request');
    assert.equal(entry.level, 'info');
    assert.equal(entry.method, 'GET');
    assert.equal(entry.path, '/health?ready=true');
    assert.equal(entry.statusCode, 204);
    assert.equal(entry.aborted, false);
    assert.equal(entry.service, 'unit-test-service');
    assert.equal(entry.time, '2026-01-01T00:00:00.000Z');
    assert.match(entry.requestId, /^[0-9a-fA-F-]{36}$/);
    assert.equal(typeof entry.durationMs, 'number');
    assert.ok(entry.durationMs >= 0);

    assert.equal(typeof res.headers['x-request-id'], 'string');
  } finally {
    server.close();
  }
});

test('observe reuses incoming request id header', async () => {
  const app = createApp();
  const entries = [];

  observe(app, {
    logger: (entry) => entries.push(entry),
  });

  const server = http.createServer((req, res) => {
    app._middleware(req, res, () => {
      res.statusCode = 200;
      res.end('ok');
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server, {
      headers: { 'x-request-id': 'req-123' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].requestId, 'req-123');
    assert.equal(res.headers['x-request-id'], 'req-123');
  } finally {
    server.close();
  }
});

test('log.info includes request context during request lifecycle', async () => {
  const app = createApp();
  const entries = [];

  observe(app, {
    logger: (entry) => entries.push(entry),
    service: 'request-context-test',
    now: () => Date.UTC(2026, 0, 1, 0, 0, 0),
  });

  const server = http.createServer((req, res) => {
    app._middleware(req, res, () => {
      const context = getRequestContext();
      assert.equal(context.requestId, res.getHeader('x-request-id'));

      log.info('inside handler', { routeName: 'health' });
      res.statusCode = 200;
      res.end('ok');
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server);
    assert.equal(res.statusCode, 200);
    assert.equal(entries.length, 2);

    const appLog = entries.find((entry) => entry.message === 'inside handler');
    assert.ok(appLog);
    assert.equal(appLog.requestId, res.headers['x-request-id']);
    assert.equal(appLog.method, 'GET');
    assert.equal(appLog.path, '/health?ready=true');
    assert.equal(appLog.service, 'request-context-test');
    assert.equal(appLog.routeName, 'health');
  } finally {
    server.close();
  }
});

test('log.child adds static bindings to emitted entries', () => {
  const entries = [];
  const app = createApp();

  observe(app, {
    logger: (entry) => entries.push(entry),
  });

  const authLog = log.child({ module: 'auth', component: 'jwt' });
  authLog.info('token checked', { userId: 'u_123' });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].message, 'token checked');
  assert.equal(entries[0].module, 'auth');
  assert.equal(entries[0].component, 'jwt');
  assert.equal(entries[0].userId, 'u_123');
});

test('log.child composes with request context and per-call fields', async () => {
  const app = createApp();
  const entries = [];

  observe(app, {
    logger: (entry) => entries.push(entry),
    service: 'root-service',
  });

  const requestLog = log.child({ module: 'handlers', service: 'child-service' });

  const server = http.createServer((req, res) => {
    app._middleware(req, res, () => {
      requestLog.info('request started', { service: 'call-service', action: 'start' });
      res.statusCode = 200;
      res.end('ok');
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server);
    assert.equal(res.statusCode, 200);

    const childEntry = entries.find((entry) => entry.message === 'request started');
    assert.ok(childEntry);
    assert.equal(childEntry.requestId, res.headers['x-request-id']);
    assert.equal(childEntry.module, 'handlers');
    assert.equal(childEntry.service, 'call-service');
    assert.equal(childEntry.action, 'start');
  } finally {
    server.close();
  }
});

test('log("message") acts as info shorthand', () => {
  const entries = [];
  const app = createApp();

  observe(app, {
    logger: (entry) => entries.push(entry),
  });

  log('shorthand works', { area: 'payments' });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, 'info');
  assert.equal(entries[0].message, 'shorthand works');
  assert.equal(entries[0].area, 'payments');
});

test('observe lifecycle hooks receive start and finish events', async () => {
  const app = createApp();
  const entries = [];
  const calls = [];

  observe(app, {
    logger: (entry) => entries.push(entry),
    service: 'hooks-test',
    hooks: {
      onRequestStart(payload) {
        calls.push({ type: 'start', payload });
      },
      onRequestFinish(payload) {
        calls.push({ type: 'finish', payload });
      },
    },
  });

  const server = http.createServer((req, res) => {
    app._middleware(req, res, () => {
      res.statusCode = 201;
      res.end('created');
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server);
    assert.equal(res.statusCode, 201);
    assert.equal(entries.length, 1);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].type, 'start');
    assert.equal(calls[1].type, 'finish');

    assert.equal(calls[0].payload.requestId, res.headers['x-request-id']);
    assert.equal(calls[1].payload.requestId, res.headers['x-request-id']);
    assert.equal(calls[1].payload.entry.statusCode, 201);
    assert.equal(calls[1].payload.entry.aborted, false);
    assert.equal(calls[1].payload.context.service, 'hooks-test');
  } finally {
    server.close();
  }
});
