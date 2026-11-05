#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
root="$(pwd -P)"
state=.local/server
if [[ ! -d "$state" ]]; then
  printf 'The local server is already stopped.\n'
  exit 0
fi

if ! read -r pid <"$state/pid" || [[ ! "$pid" =~ ^[1-9][0-9]*$ ]]; then
  printf 'The local server has no valid process ID. Check .local/server before retrying.\n' >&2
  exit 1
fi

# Check the full command before signaling a PID from an old run.
expected="node --env-file-if-exists=.env $root/apps/api/server.js"
if kill -0 "$pid" 2>/dev/null; then
  command_line="$(ps -ww -p "$pid" -o command=)" || exit 1
  if [[ "$command_line" == "$expected" ]]; then
    kill "$pid"
    for ((attempt = 0; attempt < 50; attempt++)); do
      command_line="$(ps -ww -p "$pid" -o command= || true)"
      if [[ "$command_line" != "$expected" ]]; then
        break
      fi
      sleep 0.1
    done
    if [[ "$command_line" == "$expected" ]]; then
      printf 'The local server did not stop.\n' >&2
      exit 1
    fi
  fi
fi

rm -f "$state/pid" "$state/server.log"
rmdir "$state"
printf 'The local server is stopped.\n'
