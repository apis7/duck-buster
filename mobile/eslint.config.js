// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
  {
    // Apostrophes in <Text> are just text in React Native; there's no HTML to escape.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
