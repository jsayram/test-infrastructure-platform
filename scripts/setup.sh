#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
root="$(pwd -P)"
expected_version="v$(cat .nvmrc)"
if ! command -v node >/dev/null || [[ "$(node --version)" != "$expected_version" ]]; then
  printf 'Node %s is required. Run nvm install and nvm use, or use the installer linked in README.md.\n' "$expected_version" >&2
  exit 1
fi

umask 077
mkdir -p .local
if ! mkdir .local/server 2>/dev/null; then
  printf 'A local run already exists. Run ./scripts/teardown.sh before starting again.\n' >&2
  exit 1
fi

state=.local/server
server="$root/apps/api/server.js"
pid=
cleanup() {
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$state/pid" "$state/server.log"
  rmdir "$state"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

nohup node --env-file-if-exists=.env "$server" >"$state/server.log" 2>&1 </dev/null &
pid=$!
printf '%s\n' "$pid" >"$state/pid"

for ((attempt = 0; attempt < 50; attempt++)); do
  if ! kill -0 "$pid" 2>/dev/null; then
    break
  fi
  if grep '^Listening at http://' "$state/server.log"; then
    trap - EXIT INT TERM
    exit 0
  fi
  sleep 0.1
done

printf 'The local server did not start.\n' >&2
cat "$state/server.log" >&2
exit 1
