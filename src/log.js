'use strict';

const { getRequestContext } = require('./context');

let writer = defaultWriter;

const log = createLogger();

function setLogWriter(nextWriter) {
  if (typeof nextWriter === 'function') {
    writer = nextWriter;
  }
}

function createLogger(bindings = {}) {
  const ownBindings = sanitizeRecord(bindings);
  const logger = function logger(messageOrFields, fields) {
    emit('info', ownBindings, messageOrFields, fields);
  };

  logger.debug = function debug(messageOrFields, fields) {
    emit('debug', ownBindings, messageOrFields, fields);
  };
  logger.info = function info(messageOrFields, fields) {
    emit('info', ownBindings, messageOrFields, fields);
  };
  logger.warn = function warn(messageOrFields, fields) {
    emit('warn', ownBindings, messageOrFields, fields);
  };
  logger.error = function error(messageOrFields, fields) {
    emit('error', ownBindings, messageOrFields, fields);
  };
  logger.child = function child(extraBindings) {
    return createLogger({
      ...ownBindings,
      ...sanitizeRecord(extraBindings),
    });
  };

  return logger;
}

function emit(level, bindings, messageOrFields, maybeFields) {
  const { message, fields } = normalizeArgs(messageOrFields, maybeFields);

  const entry = {
    level,
    time: new Date().toISOString(),
    ...sanitizeRecord(getRequestContext()),
    ...bindings,
    ...fields,
  };

  if (message !== undefined) {
    entry.message = message;
  }

  safeWrite(entry);
}

function normalizeArgs(messageOrFields, maybeFields) {
  if (typeof messageOrFields === 'string') {
    return {
      message: messageOrFields,
      fields: sanitizeRecord(maybeFields),
    };
  }

  if (messageOrFields && typeof messageOrFields === 'object') {
    return {
      message: undefined,
      fields: sanitizeRecord(messageOrFields),
    };
  }

  if (messageOrFields === undefined || messageOrFields === null) {
    return {
      message: undefined,
      fields: sanitizeRecord(maybeFields),
    };
  }

  return {
    message: String(messageOrFields),
    fields: sanitizeRecord(maybeFields),
  };
}

function sanitizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function safeWrite(entry) {
  try {
    writer(entry);
  } catch {
    // no-op: logging should never break app execution
  }
}

function defaultWriter(entry) {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = {
  log,
  setLogWriter,
};
