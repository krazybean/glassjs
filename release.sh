#!/usr/bin/env bash

set -e

# --- Validate input ---
if [ -z "$1" ]; then
  echo "Usage: ./release.sh [patch|minor|major]"
  exit 1
fi

VERSION_TYPE=$1

# --- Ensure clean working tree ---
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Git working directory is not clean. Commit changes first."
  exit 1
fi

# --- Run tests ---
echo "🔍 Running tests..."
npm test

# --- Bump version ---
echo "📦 Bumping version ($VERSION_TYPE)..."
npm version $VERSION_TYPE

# --- Push changes + tags ---
echo "⬆️ Pushing to Git..."
git push origin main --tags

# --- Publish ---
echo "🚀 Publishing to npm..."
npm publish --access public

echo "✅ Release complete!"