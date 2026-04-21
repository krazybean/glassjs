'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const requestContextStorage = new AsyncLocalStorage();

function runWithRequestContext(context, fn) {
  return requestContextStorage.run({ ...context }, fn);
}

function getRequestContext() {
  return requestContextStorage.getStore() || null;
}

function patchRequestContext(partialContext) {
  if (!partialContext || typeof partialContext !== 'object') {
    return getRequestContext();
  }

  const current = requestContextStorage.getStore();
  if (!current) {
    return null;
  }

  Object.assign(current, partialContext);
  return current;
}

module.exports = {
  runWithRequestContext,
  getRequestContext,
  patchRequestContext,
};
