#!/usr/bin/env python3
"""Hot-copy NotebookStageAccessService.class AFTER war extract (restart wipes cp)."""
from __future__ import annotations

import os
import socket
import sys
import time

import paramiko

HOST = os.environ.get("AHRI_SSH_HOST", "196.188.62.155")
USER = os.environ.get("AHRI_SSH_USER", "openelis")
PW = os.environ.get("AHRI_SSH_PASSWORD", "")
CLASS_LOCAL = os.environ.get(
    "AHRI_CLASS",
    "/home/dawit/Ahri/OpenELIS-Global-2/target/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class",
)

REMOTE_SH = r"""#!/bin/bash
set -euxo pipefail
WEB=openelisglobal-webapp
F='/usr/local/tomcat/webapps/api#OpenELIS-Global/WEB-INF/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class'

echo BEFORE_SIZE=$(docker exec "$WEB" stat -c%s "$F" || echo missing)
EXPECT=$(stat -c%s /tmp/NotebookStageAccessService.class)
echo EXPECT=$EXPECT

# Copy onto running container (writable layer)
docker cp /tmp/NotebookStageAccessService.class "$WEB:$F"
echo AFTER_CP_SIZE=$(docker exec "$WEB" stat -c%s "$F")

docker exec "$WEB" python3 -c '
import pathlib
p=pathlib.Path("/usr/local/tomcat/webapps/api#OpenELIS-Global/WEB-INF/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class")
b=p.read_bytes()
print("size", len(b))
print("hasLabUnitScoped", b"getLabUnitScopedDepartmentPersonaNames" in b)
'

# Soft-reload Tomcat without recreating the container
docker exec "$WEB" sh -c 'pkill -f org.apache.catalina.startup.Bootstrap || pkill -f java || true' || true

# Wait for Tomcat/Java to come back and war path to exist; re-copy after extract
for i in $(seq 1 40); do
  sleep 3
  if docker exec "$WEB" test -f "$F"; then
    SZ=$(docker exec "$WEB" stat -c%s "$F" || echo 0)
    echo "loop $i size=$SZ expect=$EXPECT"
    docker cp /tmp/NotebookStageAccessService.class "$WEB:$F"
    NEW=$(docker exec "$WEB" stat -c%s "$F")
    echo "after_recopy=$NEW"
    if docker exec "$WEB" python3 -c '
import pathlib,sys
p=pathlib.Path("/usr/local/tomcat/webapps/api#OpenELIS-Global/WEB-INF/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class")
b=p.read_bytes()
print("final_size", len(b))
ok=b"getLabUnitScopedDepartmentPersonaNames" in b
print("final_hasLabUnitScoped", ok)
sys.exit(0 if ok else 1)
'; then
      break
    fi
  fi
done

sleep 20
docker exec "$WEB" python3 -c '
import pathlib,sys
p=pathlib.Path("/usr/local/tomcat/webapps/api#OpenELIS-Global/WEB-INF/classes/org/openelisglobal/notebook/service/NotebookStageAccessService.class")
b=p.read_bytes()
print("verify_size", len(b))
print("verify_hasLabUnitScoped", b"getLabUnitScopedDepartmentPersonaNames" in b)
assert b"getLabUnitScopedDepartmentPersonaNames" in b
'
echo BE_HOTCOPY_OK
"""


def connect(retries: int = 40) -> paramiko.SSHClient:
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
            print(f"connected {a}", flush=True)
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
        raise SystemExit(f"missing {CLASS_LOCAL}")

    expected = os.path.getsize(CLASS_LOCAL)
    print(f"local class size={expected}", flush=True)

    client = connect()
    sftp = client.open_sftp()
    sftp.put(CLASS_LOCAL, "/tmp/NotebookStageAccessService.class")
    with sftp.file("/tmp/deploy_be_hot.sh", "w") as f:
        f.write(REMOTE_SH)
    sftp.chmod("/tmp/deploy_be_hot.sh", 0o755)
    sftp.close()

    stdin, stdout, stderr = client.exec_command("bash /tmp/deploy_be_hot.sh", timeout=360)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    print("OUT:\n", out[-5000:], flush=True)
    print("ERR:\n", err[-3000:], flush=True)
    print("exit", code, flush=True)
    client.close()
    if "BE_HOTCOPY_OK" not in out:
        raise SystemExit(1)
    print("SUCCESS", flush=True)


if __name__ == "__main__":
    main()
