#!/bin/sh
set -eu
cd "$(dirname "$0")"
tar --exclude='./.git' --exclude='./data' --exclude='./public/source-code.tar.gz' -czf /tmp/karacar-source-build.tar.gz .
mv /tmp/karacar-source-build.tar.gz public/source-code.tar.gz
