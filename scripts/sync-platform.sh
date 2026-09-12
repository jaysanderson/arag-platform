#!/bin/sh
# Vendor this platform into a product repo: copies src/ and ui/ into <target>/vendor/arag-platform
# and stamps PLATFORM_VERSION. Usage: sh scripts/sync-platform.sh ../my-product
set -eu
TARGET="${1:?target repo dir required}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$TARGET/vendor/arag-platform"
VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HERE/package.json','utf8')).version)")"
mkdir -p "$DEST"
rm -rf "$DEST/src" "$DEST/ui" "$DEST/scripts"
cp -R "$HERE/src" "$DEST/src"
cp -R "$HERE/ui" "$DEST/ui"
mkdir -p "$DEST/scripts" && cp "$HERE/scripts/openapi-to-md.ts" "$DEST/scripts/openapi-to-md.ts"
cp "$HERE/LICENSE" "$DEST/LICENSE"
printf '%s\n' "$VERSION" > "$DEST/PLATFORM_VERSION"
cat > "$DEST/README.md" <<README
# Vendored ARAG platform v$VERSION

Do not edit files here. Change the platform repo and re-run \`make sync-platform TARGET=<this repo>\` from it.
Source: arag-platform (Apache-2.0). Synced $(date -u +%Y-%m-%dT%H:%M:%SZ).
README
echo "synced arag-platform v$VERSION -> $DEST"
