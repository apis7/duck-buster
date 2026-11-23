// Debug IDs on the JS bundle so crash stacks map back to source. Local only: uploads
// go through crash-upload (scripts/release-android.sh), never Sentry's tooling.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname, { includeWebReplay: false, includeWebFeedback: false });
