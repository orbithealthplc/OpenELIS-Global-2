#!/usr/bin/env python3
"""Hot-deploy NotebookStageAccessService.class to AHRI prod webapp."""
from __future__ import annotations

import os
import socket
import sys
import time

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "paramiko"])
    import paramiko

HOST = os.environ.get("AHRI_SSH_HOST", "196.188.62.155")
USER = os.environ.get("AHRI_SSH_USER", "openelis")
PW = os.environ.get("AHRI_SSH_PASSWORD", "")
CLASS_LOCAL = os.environ.get(
    "AHRI_CLASS",
    "/home/dawit/Ahri/OpenELIS-Global-2/target/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class",
)

DEPLOY_SH = r"""#!/bin/bash
set -euxo pipefail
WEB=openelisglobal-webapp
docker ps --format '{{.Names}}' | head -30
ls -la /tmp/NotebookStageAccessService.class
FOUND=$(docker exec "$WEB" sh -c 'find /usr/local/tomcat/webapps -name NotebookStageAccessService.class 2>/dev/null | head -1' || true)
F=${FOUND:-/usr/local/tomcat/webapps/OpenELIS-Global/WEB-INF/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class}
echo FILE=$F
docker cp /tmp/NotebookStageAccessService.class "$WEB:$F"
docker exec "$WEB" ls -la "$F"
docker restart "$WEB"
for i in $(seq 1 25); do
  sleep 3
  st=$(docker inspect -f '{{.State.Status}}' "$WEB" || true)
  echo status=$st
  if [ "$st" = running ]; then
    sleep 15
    echo BE_DEPLOY_OK
    exit 0
  fi
done
echo BE_DEPLOY_FAIL
exit 1
"""


def connect(retries: int = 50) -> paramiko.SSHClient:
    last: Exception | None = None
    for a in range(1, retries + 1):
        try:
            socket.create_connection((HOST, 22), timeout=5).close()
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                HOST,
                username=USER,
                password=PW,
                timeout=25,
                allow_agent=False,
                look_for_keys=False,
                banner_timeout=40,
                auth_timeout=40,
            )
            print(f"connected try {a}", flush=True)
            return client
        except Exception as e:  # noqa: BLE001
            last = e
            if a % 3 == 0:
                print(f"connect fail {a}: {e}", flush=True)
            time.sleep(3)
    raise SystemExit(f"cannot connect: {last}")


def main() -> None:
    if not PW:
        raise SystemExit("AHRI_SSH_PASSWORD required")
    if not os.path.isfile(CLASS_LOCAL):
        raise SystemExit(f"missing class: {CLASS_LOCAL}")

    client = connect()
    sftp = client.open_sftp()
    sftp.put(CLASS_LOCAL, "/tmp/NotebookStageAccessService.class")
    print("uploaded class", flush=True)
    with sftp.file("/tmp/deploy_be_class.sh", "w") as f:
        f.write(DEPLOY_SH)
    sftp.chmod("/tmp/deploy_be_class.sh", 0o755)
    sftp.close()
    print("uploaded script", flush=True)

    stdin, stdout, stderr = client.exec_command("bash /tmp/deploy_be_class.sh", timeout=360)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    print("OUT:\n", out[-5000:], flush=True)
    print("ERR:\n", err[-2000:], flush=True)
    print("exit", code, flush=True)
    client.close()
    if "BE_DEPLOY_OK" not in out and "BE_DEPLOY_OK" not in err:
        raise SystemExit(1)
    print("BE_SUCCESS", flush=True)


if __name__ == "__main__":
    main()
