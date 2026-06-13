#!/usr/bin/env sh
set -eu

printf "cleanup:%s\n" "$MOBTRACE_JOURNEY_STATUS" > "$MOBTRACE_ARTIFACTS_DIR/interrupted-cleanup.txt"
