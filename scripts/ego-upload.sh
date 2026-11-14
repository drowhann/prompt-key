#!/usr/bin/env bash
# Upload a packed extension zip to extensions.gnome.org.
# Needs: curl, jq
# Auth: EGO_USERNAME + EGO_PASSWORD (or pass -u/-p)
set -euo pipefail

LOGIN_URL="https://extensions.gnome.org/api/v1/accounts/login/"
UPLOAD_URL="https://extensions.gnome.org/api/v1/extensions"

usage() {
  cat <<'EOF'
Usage: ego-upload.sh [-u USER] [-p PASS] <extension.zip>

Env:
  EGO_USERNAME   EGO account username
  EGO_PASSWORD   EGO account password
EOF
}

die() { echo "ERROR: $*" >&2; exit 1; }

username="${EGO_USERNAME:-}"
password="${EGO_PASSWORD:-}"
zip=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -u) username="$2"; shift 2 ;;
    -p) password="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) zip="$1"; shift ;;
  esac
done

[[ -n "$zip" ]] || die "zip path required"
[[ -f "$zip" ]] || die "file not found: $zip"
[[ -n "$username" ]] || die "set EGO_USERNAME or pass -u"
[[ -n "$password" ]] || die "set EGO_PASSWORD or pass -p"
command -v curl >/dev/null || die "curl required"
command -v jq >/dev/null || die "jq required"

echo "Logging in to extensions.gnome.org as ${username}..."
login_json=$(curl -sS -X POST "$LOGIN_URL" \
  -H "Accept: application/json" \
  --data-urlencode "login=${username}" \
  --data-urlencode "password=${password}")

token=$(echo "$login_json" | jq -r '.token.token // empty')
[[ -n "$token" ]] || die "login failed: $(echo "$login_json" | jq -c . 2>/dev/null || echo "$login_json")"

echo "Uploading $(basename "$zip")..."
# shell_license_compliant / tos_compliant required by EGO upload API
http_code=$(curl -sS -o /tmp/ego-upload-body.json -w "%{http_code}" -X POST "$UPLOAD_URL" \
  -H "Authorization: Token ${token}" \
  -F "source=@${zip}" \
  -F "shell_license_compliant=true" \
  -F "tos_compliant=true")

body=$(cat /tmp/ego-upload-body.json)
rm -f /tmp/ego-upload-body.json

if [[ "$http_code" != "201" ]]; then
  die "upload failed (HTTP ${http_code}): $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"
fi

echo "Uploaded: $(echo "$body" | jq -c .)"
