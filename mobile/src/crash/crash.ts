import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting to our own portal (crash.apsinthion.llc) with the open-source
 * Sentry SDK — never Sentry's own cloud. Crashes only: no tracing, replay, feedback or
 * screenshots, and no personal data. Setup: C:\Dev\DevTools\framework_crash_reporter\integrate.md.
 */

// Not a secret. Portal project duckbuster-android (id 15).
export const CRASH_DSN = 'https://290c875ff3ccf9b1abbf43a47d99c095@crash.apsinthion.llc/15';

/** A local test build (EXPO_PUBLIC_CRASH_TEST=1) gets the test buttons; never set for store builds. */
export const CRASH_TEST = __DEV__ || process.env.EXPO_PUBLIC_CRASH_TEST === '1';

// Hunter names, crew names and typed bird names are the only private things the
// app holds. They never go into error messages on purpose; this is the backstop.
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Only the SDK's anonymous installation id may identify the phone.
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  delete event.request;
  // File URIs from backups and QR transfers can carry a phone's folder names.
  const clean = (s?: string) => s?.replace(/(file|content):\/\/[^\s'"]+/g, '<uri>');
  event.message = clean(event.message);
  for (const ex of event.exception?.values ?? []) ex.value = clean(ex.value);
  return event;
}

export function startCrashReporting(): void {
  if (!CRASH_DSN) return;
  Sentry.init({
    dsn: CRASH_DSN,
    environment: __DEV__ ? 'development' : process.env.EXPO_PUBLIC_CRASH_TEST === '1' ? 'staging' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: (event) => scrub(event),
    // Console lines and touch targets can carry what someone typed; navigation and app state stay.
    beforeBreadcrumb: (b) => (b.category === 'console' || b.category === 'ui.input' || b.category === 'touch' ? null : b),
  });
}

export const wrapRoot = Sentry.wrap;

/** Debug builds only (More screen): proves crashes reach the portal. */
export const testCrash = {
  js: () => {
    throw new Error('crash-reporter test');
  },
  native: () => Sentry.nativeCrash(),
};
