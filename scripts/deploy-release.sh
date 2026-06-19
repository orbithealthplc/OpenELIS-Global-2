#!/usr/bin/env bash
# Deploy an OpenELIS GHCR release to /opt/OpenELIS-Docker on an AHRI host.
#
# Usage:
#   GHCR_READ_USER=github_user GHCR_READ_TOKEN=ghp_xxx \
#     ./scripts/deploy-release.sh v2026.06.18.05 [host]
#
# Hosts:
#   Test: 192.168.176.127  (deploy here first, then prod)
#   Prod: 192.168.25.25
#
# Requires: SSH key access as openelis@host, and GHCR_READ_* env vars.
# On-server alternative (when SSH from dev machine is unavailable):
#   scp scripts/deploy-release-on-server.sh openelis@192.168.176.127:/opt/OpenELIS-Docker/
#   ssh openelis@192.168.176.127
#   cd /opt/OpenELIS-Docker && GHCR_READ_USER=... GHCR_READ_TOKEN=... sudo -E bash deploy-release-on-server.sh v2026.06.18.05
set -euo pipefail

RELEASE="${1:?Release tag required, e.g. v2026.06.18.05}"
HOST="${2:-192.168.25.25}"
APP_DIR="/opt/OpenELIS-Docker"
REMOTE="openelis@${HOST}"

if [[ -z "${GHCR_READ_USER:-}" || -z "${GHCR_READ_TOKEN:-}" ]]; then
  echo "ERROR: Set GHCR_READ_USER and GHCR_READ_TOKEN before running." >&2
  echo "  export GHCR_READ_USER=your_github_username" >&2
  echo "  export GHCR_READ_TOKEN=ghp_...  # classic PAT with read:packages" >&2
  exit 1
fi

echo "Deploying ${RELEASE} to ${HOST}..."

ssh "${REMOTE}" "bash -s" <<EOF
set -euo pipefail
export GHCR_READ_USER='${GHCR_READ_USER}'
export GHCR_READ_TOKEN='${GHCR_READ_TOKEN}'
export APP_DIR='${APP_DIR}'
cd "\${APP_DIR}"

sudo cp docker-compose.yml "docker-compose.yml.bak-${RELEASE}"
sudo sed -i 's#v2026\\.[0-9][0-9]\\.[0-9][0-9]\\.[0-9][0-9]#${RELEASE}#g' docker-compose.yml
echo '--- image tags ---'
grep -E 'ghcr.io/orbithealthplc/openelis-global-2' docker-compose.yml || true

echo "\${GHCR_READ_TOKEN}" | sudo docker login ghcr.io -u "\${GHCR_READ_USER}" --password-stdin
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps

IMAGE=\$(sudo docker inspect openelisglobal-webapp --format '{{.Config.Image}}')
echo "Webapp image: \${IMAGE}"
if [[ "\${IMAGE}" != *"${RELEASE}"* ]]; then
  echo "WARNING: webapp image does not contain ${RELEASE}" >&2
  exit 1
fi
EOF

echo "Copying notebook department linkages..."
scp volume/configuration/backend/notebook-departments/research-lab-linkages.csv \
  "${REMOTE}:${APP_DIR}/volume/configuration/backend/notebook-departments/research-lab-linkages.csv"

ssh "${REMOTE}" "sudo docker restart openelisglobal-webapp"

echo "Done. Optional cleanup:"
echo "  docker exec -i openelisglobal-database psql -U clinlims -d clinlims < scripts/deactivate-non-notebook-departments.sql"
