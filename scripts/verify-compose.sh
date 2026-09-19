#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${1:?usage: verify-compose.sh PATH_TO_ENV_FILE}"
project="vibeguard-release"
compose=(docker compose --env-file "$env_file" -p "$project" -f "$repo_root/docker-compose.yml")
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

"${compose[@]}" up -d --wait --wait-timeout 180
curl --fail --silent --show-error http://127.0.0.1:3001/ready > "$work/ready.json"
curl --fail --silent --show-error http://127.0.0.1:5173/ > "$work/index.html"

email="release-$(date +%s)-$RANDOM@example.test"
password="Release-$(cat /proc/sys/kernel/random/uuid)!"
repo_name="compose-persistence-$RANDOM"
python3 - "$email" "$password" > "$work/register-request.json" <<'PY'
import json, sys
print(json.dumps({"email": sys.argv[1], "password": sys.argv[2], "name": "Release Gate"}))
PY
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  --data-binary @"$work/register-request.json" \
  http://127.0.0.1:5173/api/auth/register > "$work/register-response.json"
token="$(python3 - "$work/register-response.json" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8")).get("token")
if not value:
    raise SystemExit("registration did not return a token")
print(value)
PY
)"

python3 - "$repo_name" > "$work/upload.json" <<'PY'
import json, sys
print(json.dumps({
    "repositoryName": sys.argv[1],
    "numericScore": 100,
    "score": "A",
    "coverage": {"code": True, "dependencies": True, "secrets": True, "containers": True, "iac": True, "web": False, "cloud": False},
    "findings": [{"scanner": "Semgrep", "ruleId": "release-gate", "title": "Synthetic release finding", "severity": "LOW", "file": "fixture.js", "line": 1}]
}))
PY
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  --data-binary @"$work/upload.json" \
  http://127.0.0.1:5173/api/scans/upload > "$work/upload-response.json"
python3 - "$work/upload-response.json" "$repo_name" <<'PY'
import json, sys
scan = json.load(open(sys.argv[1], encoding="utf-8"))
assert scan["repository"]["name"] == sys.argv[2]
assert len(scan["findings"]) == 1
PY

"${compose[@]}" down
"${compose[@]}" up -d --wait --wait-timeout 180
python3 - "$email" "$password" > "$work/login.json" <<'PY'
import json, sys
print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))
PY
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  --data-binary @"$work/login.json" \
  http://127.0.0.1:5173/api/auth/login > "$work/login-response.json"
token="$(python3 - "$work/login-response.json" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8")).get("token")
if not value:
    raise SystemExit("login after restart did not return a token")
print(value)
PY
)"
curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  http://127.0.0.1:5173/api/repositories > "$work/repositories.json"
python3 - "$work/ready.json" "$work/repositories.json" "$repo_name" <<'PY'
import json, sys
ready = json.load(open(sys.argv[1], encoding="utf-8"))
repositories = json.load(open(sys.argv[2], encoding="utf-8"))
assert ready["status"] == "ready" and ready["database"] == "connected"
assert any(repo["name"] == sys.argv[3] for repo in repositories)
print(json.dumps({
    "api": "ready",
    "database": "connected",
    "web": "served",
    "reverseProxy": "passed",
    "authenticatedUpload": "passed",
    "persistenceAfterRestart": "passed"
}))
PY
