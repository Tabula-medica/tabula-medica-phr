#!/usr/bin/env bash
# Export source files without credentials. See README.md, "Project export".
set -euo pipefail
umask 077

usage() {
  printf 'Usage: %s [--safe-mode]\n' "$0"
}

safe_mode=false
case "${1:-}" in
  --safe-mode) safe_mode=true; shift ;;
  -h|--help) usage; exit 0 ;;
esac
if (( $# )); then
  usage >&2
  exit 2
fi

for command in find zip mktemp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 1
  fi
done

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
output="$PWD/tabula-medica.zip"
workdir=$(mktemp -d "$PWD/.export-project.XXXXXXXX")
trap 'rm -rf -- "$workdir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Prune private metadata/history, dependencies, local data, generated outputs,
# and old archives. Never follow symlinks (including links to external secrets).
excluded_dirs=(
  -name .git -o -name .local -o -name ' .local' -o -name .agents
  -o -name .config -o -name .cache -o -name .expo -o -name node_modules
  -o -name .ssh -o -name .aws -o -name .azure -o -name .gnupg
  -o -name .kube -o -name .docker
  -o -name .export-project.* -o -name generated-artifacts
  -o -name dist -o -name dist-expo-web -o -name server_dist
  -o -name static-build -o -name web-build -o -name build
  -o -name coverage -o -name exports -o -name uploads -o -name logs
)
if "$safe_mode"; then
  excluded_dirs+=( -o -name attached_assets )
fi

# Match basenames at every depth, including ignored/untracked credential files.
excluded_files=(
  -name '*.p8' -o -name '*.p12' -o -name '*.mobileprovision'
  -o -name credentials.json -o -name appstore-api-key.p8 -o -name '.env*'
  -o -name deploy.sh -o -name '*.pem' -o -name '*.key' -o -name '*.jks'
  -o -name '*.keystore' -o -name '*.crt' -o -name serviceAccountKey.json
  -o -name gcp-wif-config.json -o -name 'firebase-admin-sdk*.json'
  -o -name 'google-credentials*.json' -o -name 'google-service-account*.json'
  -o -iname '*.zip' -o -name '*.log'
  -o -name .npmrc -o -name .yarnrc -o -name .yarnrc.yml
  -o -name .netrc -o -name _netrc -o -name .pypirc
  -o -name .git-credentials -o -name .boto -o -name .pgpass -o -name .my.cnf
  -o -name 'id_rsa*' -o -name 'id_dsa*' -o -name 'id_ecdsa*' -o -name 'id_ed25519*'
)
find . -type d \( "${excluded_dirs[@]}" \) -prune -o \
  -type f ! \( "${excluded_files[@]}" \) -print0 > "$workdir/files.nul"

# zip -@ reads newline-delimited paths. Reject unrepresentable filenames rather
# than silently archiving the wrong file. Spaces and leading dashes are safe.
while IFS= read -r -d '' file; do
  if [[ "$file" == *$'\n'* || "$file" == *$'\r'* ]]; then
    printf 'Export aborted: a filename contains a newline or carriage return.\n' >&2
    exit 1
  fi
  printf '%s\n' "$file"
done < "$workdir/files.nul" > "$workdir/files.txt"
if [[ ! -s "$workdir/files.txt" ]]; then
  printf 'Export aborted: no eligible files found.\n' >&2
  exit 1
fi

# Always build a NEW archive: updating an existing ZIP can retain old secrets
# or attached_assets entries from a previous non-safe export.
zip -q "$workdir/tabula-medica.zip" -@ < "$workdir/files.txt"
mv -f -- "$workdir/tabula-medica.zip" "$output"
printf 'Created tabula-medica.zip (safe mode: %s).\n' "$safe_mode"
