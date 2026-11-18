// Windows: native object paths under node_modules run past 260 characters
// (Gesture Handler 3's codegen, Reanimated's CSS interpolation sources…).
// The SDK's default CMake 3.22 ships ninja 1.10, which can't handle long paths.
// CMake 3.31.6 ships ninja 1.12, which can (with Windows long paths enabled).
// Pinned for the app and for every Android library module that builds C++.
const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const MARKER = `version "${CMAKE_VERSION}"`;
const ROOT_MARKER = '// duck-buster: long-path cmake';

module.exports = function withLongPathCmake(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /\nandroid\s*\{/,
      (m) => `${m}\n    externalNativeBuild {\n        cmake {\n            ${MARKER}\n        }\n    }`,
    );
    return cfg;
  });
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(ROOT_MARKER)) return cfg;
    cfg.modResults.contents += `
${ROOT_MARKER}
subprojects {
    pluginManager.withPlugin('com.android.library') {
        android {
            externalNativeBuild {
                cmake {
                    ${MARKER}
                }
            }
        }
    }
}
`;
    return cfg;
  });
};
