#!/usr/bin/env bash
# Keep failures visible in check annotations as well as downloadable CI logs.
set -eu
log=$(mktemp)
trap 'rm -f "$log"' EXIT
if "$@" >"$log" 2>&1; then
  cat "$log"
else
  cat "$log"
  tail -25 "$log" | while IFS= read -r line; do
    line=${line//'%'/'%25'}
    line=${line//$'\r'/'%0D'}
    printf '::error::%s\n' "$line"
  done
  exit 1
fi
