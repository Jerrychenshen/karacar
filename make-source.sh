#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Explicit source allowlist: never package data, credentials, evidence or backups.
archive_tmp=$(mktemp /tmp/karacar-source.XXXXXX)
trap 'rm -f "$archive_tmp"' EXIT HUP INT TERM
tar -czf "$archive_tmp" .gitignore CHANGES.md LICENSE README.md make-source.sh package.json render.yaml server.js public/*.js public/*.css public/*.html public/*.svg test/*.test.mjs
mv "$archive_tmp" public/source-code.tar.gz
