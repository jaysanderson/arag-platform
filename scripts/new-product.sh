#!/bin/sh
# Scaffold a product repo from template/: sh scripts/new-product.sh <slug> <dir>
set -eu
NAME="${1:?slug required (e.g. my-product)}"
DIR="${2:?target dir required}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TITLE="$(printf '%s' "$NAME" | awk -F- '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}; print}' OFS=' ')"
mkdir -p "$DIR"
cp -R "$HERE/template/." "$DIR/" && mv "$DIR/_biome.json" "$DIR/biome.json"
sh "$HERE/scripts/sync-platform.sh" "$DIR" >/dev/null
find "$DIR" -type f \( -name '*.ts' -o -name '*.md' -o -name '*.json' -o -name '*.toml' -o -name '*.html' -o -name 'Makefile' -o -name '.env.example' -o -name '*.yml' \) -not -path '*/vendor/*' -exec sed -i '' -e "s/__PRODUCT_SLUG__/$NAME/g" -e "s/__PRODUCT_TITLE__/$TITLE/g" {} +
cp "$HERE/LICENSE" "$DIR/LICENSE"
( cd "$DIR" && git init -q 2>/dev/null || true )
echo "scaffolded $TITLE in $DIR — next: cd $DIR && make install && make dev"
