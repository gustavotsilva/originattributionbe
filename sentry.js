import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0
});

const SentryError = {
  INFO: 1,
  INCIDENT: 2
};

function sentryLog(type = SentryError.INCIDENT, scope, message) {
  Sentry.setContext("body", scope);
  if (type == SentryError.INFO) Sentry.captureMessage(message);
  else Sentry.captureException(message);
}

export { SentryError, sentryLog};