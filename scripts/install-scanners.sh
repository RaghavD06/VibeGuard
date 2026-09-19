#!/usr/bin/env bash
set -euo pipefail
# Linux x86_64/aarch64; install into an isolated prefix, with pinned tool versions.
SEMGREP_VERSION=1.177.0
CHECKOV_VERSION=3.3.19
GITLEAKS_VERSION=8.30.1
TRIVY_VERSION=0.74.0
prefix=${SCANNER_PREFIX:-/opt/vibeguard-scanners}
bin=${SCANNER_BIN:-/usr/local/bin}
mkdir -p "$prefix" "$bin"
python3 -m venv "$prefix/semgrep"
"$prefix/semgrep/bin/pip" install --no-cache-dir "semgrep==$SEMGREP_VERSION"
python3 -m venv "$prefix/checkov"
"$prefix/checkov/bin/pip" install --no-cache-dir "checkov==$CHECKOV_VERSION"
ln -sf "$prefix/semgrep/bin/semgrep" "$bin/semgrep"
ln -sf "$prefix/checkov/bin/checkov" "$bin/checkov"
case "$(uname -m)" in
  x86_64) leak_arch=x64; trivy_arch=64bit ;;
  aarch64|arm64) leak_arch=arm64; trivy_arch=ARM64 ;;
  *) echo 'Unsupported scanner architecture' >&2; exit 1 ;;
esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
download() { curl --fail --show-error --location --retry 3 --max-time 180 "$1" -o "$2"; }
leak_file="gitleaks_${GITLEAKS_VERSION}_linux_${leak_arch}.tar.gz"
leak_base="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"
download "$leak_base/$leak_file" "$leak_file"
download "$leak_base/gitleaks_${GITLEAKS_VERSION}_checksums.txt" leak-checksums.txt
grep "  $leak_file$" leak-checksums.txt | sha256sum --check -
tar -xzf "$leak_file" -C "$bin" gitleaks
trivy_file="trivy_${TRIVY_VERSION}_Linux-${trivy_arch}.tar.gz"
trivy_base="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}"
download "$trivy_base/$trivy_file" "$trivy_file"
download "$trivy_base/trivy_${TRIVY_VERSION}_checksums.txt" trivy-checksums.txt
grep "  $trivy_file$" trivy-checksums.txt | sha256sum --check -
tar -xzf "$trivy_file" -C "$bin" trivy
"$bin/semgrep" --version
"$bin/checkov" --version
"$bin/gitleaks" version
"$bin/trivy" --version
