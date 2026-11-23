#!/usr/bin/env bash
# Release build + crash-portal uploads. Run through the vault so the token is injected:
#   vault_run (secret CRASH_UPLOAD_DUCKBUSTER_ANDROID → CRASH_UPLOAD_TOKEN)  bash scripts/release-android.sh
# Never uses Sentry's own upload tooling (see C:\Dev\DevTools\framework_crash_reporter\integrate.md).
set -euo pipefail
cd "$(dirname "$0")/.."
export CRASH_UPLOAD_TOKEN="${CRASH_UPLOAD_TOKEN:-${CRASH_UPLOAD_DUCKBUSTER_ANDROID:-}}"
: "${CRASH_UPLOAD_TOKEN:?upload token missing — run through the vault (CRASH_UPLOAD_DUCKBUSTER_ANDROID)}"
export CRASH_PROJECT_ID="${CRASH_PROJECT_ID:-15}"
export SENTRY_DISABLE_AUTO_UPLOAD=true
export ANDROID_HOME="${ANDROID_HOME:-$(cygpath -m "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/Android/Sdk}"

VERSION=$(node -p "require('./app.json').expo.version")
CODE=$(node -p "require('./app.json').expo.android.versionCode")
RELEASE="com.duckbuster.app@${VERSION}+${CODE}"
UP="node scripts/crash-upload.mjs"
$UP whoami

# R8 mapping id: baked into the app so the portal can de-obfuscate its stack traces.
UUID=$(node -e "console.log(require('crypto').randomUUID())")
mkdir -p android/app/src/main/assets
echo "io.sentry.ProguardUuids=${UUID}" > android/app/src/main/assets/sentry-debug-meta.properties

TASK="${TASK:-:app:bundleRelease}"
(cd android && ./gradlew --stop >/dev/null 2>&1 || true; ./gradlew "$TASK" --console=plain)

$UP proguard --uuid "$UUID" android/app/build/outputs/mapping/release/mapping.txt
# JS: the Hermes bundle and its composed source map (never shipped in the app).
MAPDIR=$(mktemp -d)
cp "$(find android/app/build/generated/assets -name index.android.bundle | head -1)" "$MAPDIR/"
cp "$(find android/app/build/generated/sourcemaps -name 'index.android.bundle.map' | head -1)" "$MAPDIR/"
$UP sourcemaps upload "$MAPDIR" --release "$RELEASE" --dist "$CODE" --url-prefix "~/"
# Native symbols for the app's own C++ (Skia, Reanimated, …).
$UP debug-files android/app/build/intermediates/merged_native_libs/release
echo "✅ $RELEASE built and symbols uploaded"
