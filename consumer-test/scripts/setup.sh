#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Clean stale tarballs from prior interrupted runs
rm -f convex-affiliates-*.tgz

# Ensure consumer-test deps are installed
if [ ! -d "node_modules/convex" ]; then
  npm install --legacy-peer-deps
fi

# Pack the already-built package (npm run build must be run before this)
(cd .. && npm pack --pack-destination consumer-test/)

# Install from tarball (exactly what consumers get)
TARBALL=$(ls -t convex-affiliates-*.tgz 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
  echo "Error: No tarball found. Run 'npm run build' in the root first."
  exit 1
fi

npm install "$TARBALL" --no-save
rm -f "$TARBALL"
echo "Consumer test setup complete"
