#!/usr/bin/env bash
set -euo pipefail

UUID="promptkey@promptkey"
ROOT="$(cd "$(dirname "$0")" && pwd)"

"${ROOT}/install.sh"

gnome-extensions disable "$UUID" || true
sleep 0.3
gnome-extensions enable "$UUID"

echo "Files synced and extension re-enabled."

# GNOME Shell 45+: ReloadExtension is deprecated and does not clear the JS module cache.
# On Wayland there is no supported hot-reload for extension code changes.
if [ "${XDG_SESSION_TYPE:-}" = "x11" ]; then
  cat <<EOF

X11: press Alt+F2, type r, Enter to restart GNOME Shell and load the new UI.
EOF
else
  cat <<EOF

Wayland: GNOME removed extension hot-reload (ReloadExtension is deprecated).
JS stays cached across disable/enable, so you need a session restart:

  gnome-session-quit --logout

Dev alternative (no full logout): nested Shell, then close that window to retry:

  dbus-run-session -- gnome-shell --nested --wayland
EOF
fi
