#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"
DIR="${ROOT}/preview"

cd "$DIR"
echo "PromptKey UI preview: http://127.0.0.1:${PORT}/"
echo "This is a browser mock for layout only. Extension still needs logout/in on Wayland."
echo "Stop with Ctrl+C."
exec python3 -m http.server "$PORT" --bind 127.0.0.1
