#!/usr/bin/env sh
set -eu

printf "cleanup fixture failed after %s\n" "$MOBTRACE_JOURNEY_STATUS" >&2
exit 13
