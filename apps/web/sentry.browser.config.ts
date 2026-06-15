import * as Sentry from "@sentry/react";

export const sentryBrowserConfig = () => {
  const dsn = import.meta.env.PUBLIC_ENV__SENTRY_DSN;
  if (import.meta.env.PROD !== true || !dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: "production-frontend",
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [/^\//, /^https:\/\/yourserver\.io\/api/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
};
