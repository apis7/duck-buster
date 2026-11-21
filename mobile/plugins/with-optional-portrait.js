const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * `orientation: portrait` makes Android infer a REQUIRED android.hardware.screen.portrait
 * feature, and Play then hides the app from devices without it (some tablets, Chromebooks,
 * desktop). The app still runs portrait everywhere; this only stops the store filtering.
 */
module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const m = cfg.modResults.manifest;
    m['uses-feature'] = (m['uses-feature'] ?? []).filter((f) => f.$['android:name'] !== 'android.hardware.screen.portrait');
    m['uses-feature'].push({ $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'false' } });
    return cfg;
  });
};
