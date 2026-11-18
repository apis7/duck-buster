// Windows: Gesture Handler 3's codegen object files
// (…/C_/Dev/duck_buster/mobile/node_modules/react-native-gesture-handler/shared/
// shadowNodes/…/RNGestureHandlerDetectorShadowNode.cpp.o) run past 260 characters.
// The SDK's default CMake 3.22 ships ninja 1.10, which can't stat long paths.
// CMake 3.31.6 ships ninja 1.12, which can (with Windows long paths enabled).
const { withAppBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const MARKER = `version "${CMAKE_VERSION}"`;

module.exports = function withLongPathCmake(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /\nandroid\s*\{/,
      (m) => `${m}\n    externalNativeBuild {\n        cmake {\n            ${MARKER}\n        }\n    }`,
    );
    return cfg;
  });
};
