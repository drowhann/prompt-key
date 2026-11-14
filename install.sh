#!/usr/bin/env bash
set -euo pipefail

UUID="promptkey@drowhann.github.io"
ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

glib-compile-schemas "${ROOT}/schemas"
mkdir -p "${EXT_DIR}"
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'prd.md' \
  --exclude 'docs/' \
  --exclude '.cursor/' \
  --exclude '*.plan.md' \
  --exclude 'scripts/' \
  --exclude 'preview/' \
  --exclude 'preview.sh' \
  --exclude 'install.sh' \
  --exclude 'reload.sh' \
  --exclude 'Makefile' \
  --exclude '*.zip' \
  "${ROOT}/" "${EXT_DIR}/"
glib-compile-schemas "${EXT_DIR}/schemas"

# Ensure enabled for next session
python3 - <<PY
import ast, subprocess
uuid = "${UUID}"
raw = subprocess.check_output(["gsettings", "get", "org.gnome.shell", "enabled-extensions"], text=True)
arr = ast.literal_eval(raw.strip())
if uuid not in arr:
    arr.append(uuid)
fmt = "[" + ", ".join("'" + x + "'" for x in arr) + "]"
subprocess.check_call(["gsettings", "set", "org.gnome.shell", "enabled-extensions", fmt])
print("enabled-extensions =", fmt)
PY

echo "Installed to ${EXT_DIR}"
echo "Reload with: ./reload.sh"
echo "On Wayland, log out and back in if Shell has not discovered the extension yet."
echo "Then use the open shortcut (default Super+Alt+A) to open PromptKey."
