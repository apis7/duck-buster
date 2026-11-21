const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Sign release builds with the Duck Buster upload key.
 *
 * `android/` is generated, so the signing config has to be re-applied on every
 * prebuild; a hand edit to build.gradle would vanish. The key itself lives outside
 * the repo (C:\Dev\keystores\duck-buster\) and is pointed at by `keystore.properties`
 * next to app.json, which is gitignored.
 *
 * A release build without that file FAILS rather than quietly falling back to the
 * debug key. A debug-signed release installed on a phone can never be updated by
 * the properly signed one — Android refuses a signature change — so the only way
 * out is uninstalling, which deletes every hunt on the phone.
 */
const MARKER = '// duckbuster-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;

    const loader = `
${MARKER}
def dbKeystore = new Properties()
def dbKeystoreFile = rootProject.file('../keystore.properties')
if (dbKeystoreFile.exists()) {
    dbKeystoreFile.withInputStream { dbKeystore.load(it) }
}
`;
    gradle = gradle.replace(/\nandroid \{/, `${loader}\nandroid {`);

    gradle = gradle.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        release {
            if (dbKeystore['storeFile']) {
                storeFile file(dbKeystore['storeFile'])
                storePassword dbKeystore['storePassword']
                keyAlias dbKeystore['keyAlias']
                keyPassword dbKeystore['keyPassword']
            }
        }
`,
    );

    const releaseBlock = /(release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/;
    if (!releaseBlock.test(gradle)) {
      throw new Error('with-release-signing: could not find the release signingConfig line to replace.');
    }
    gradle = gradle.replace(
      releaseBlock,
      `$1if (!dbKeystore['storeFile']) {
                throw new GradleException("Release builds need mobile/keystore.properties (see C:/Dev/keystores/duck-buster/README.txt). Refusing to sign with the debug key.")
            }
            signingConfig signingConfigs.release`,
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
