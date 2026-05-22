#!/usr/bin/env bash
set -euo pipefail

tmpdir="$(mktemp -d)"
cp next-env.d.ts "$tmpdir/next-env.d.ts"
cp tsconfig.json "$tmpdir/tsconfig.json"

restore_tracked_type_files() {
  cp "$tmpdir/next-env.d.ts" next-env.d.ts
  cp "$tmpdir/tsconfig.json" tsconfig.json
  rm -rf "$tmpdir"
}

trap restore_tracked_type_files EXIT

rm -rf .next-build
NEXT_DIST_DIR=.next-build next build
