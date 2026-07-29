#!/usr/bin/env python3
"""Hot-deploy local FE build ( /tmp/fe_deploy.tgz ) to AHRI prod nginx container."""
from __future__ import annotations

import os
import socket
import sys
import time

import pexpect

HOST = os.environ.get("AHRI_SSH_HOST", "196.188.62.155")
USER = os.environ.get("AHRI_SSH_USER", "openelis")
PW = os.environ.get("AHRI_SSH_PASSWORD", "")
TGZ = os.environ.get("AHRI_FE_TGZ", "/tmp/fe_deploy.tgz")
SCRIPT = os.environ.get("AHRI_FE_SCRIPT", "/tmp/deploy_fe2.sh")


def wait_port(n: int = 12) -> None:
    for a in range(1, n + 1):
        try:
            socket.create_connection((HOST, 22), timeout=6).close()
            print(f"ssh port open ({a})", flush=True)
            return
        except OSError as e:
            print(f"port closed ({a}): {e}", flush=True)
            time.sleep(3)
    raise SystemExit("SSH port unreachable")


def scp(local: str, remote: str, label: str) -> None:
    for a in range(1, 8):
        print(f"=== SCP {label} attempt {a} ===", flush=True)
        wait_port(5)
        cmd = (
            "scp -o PreferredAuthentications=password -o PubkeyAuthentication=no "
            f"-o StrictHostKeyChecking=no -o ConnectTimeout=20 {local} {USER}@{HOST}:{remote}"
        )
        child = pexpect.spawn(cmd, encoding="utf-8", timeout=300)
        try:
            i = child.expect(
                [r"(?i)password:", r"Permission denied", pexpect.EOF, pexpect.TIMEOUT],
                timeout=90,
            )
            print(f"expect={i} before_tail={(child.before or '')[-200:]!r}", flush=True)
            if i != 0:
                child.close(force=True)
                time.sleep(3)
                continue
            child.sendline(PW)
            child.expect(pexpect.EOF, timeout=300)
            child.close()
            print(f"exitstatus={child.exitstatus} out={(child.before or '')[-200:]!r}", flush=True)
            # scp may report exitstatus None briefly; treat clean EOF without errors as success
            out = child.before or ""
            if child.exitstatus == 0 or (
                "Permission denied" not in out
                and "lost connection" not in out
                and "No such file" not in out
                and "100%" in out
            ):
                return
        except Exception as e:
            print(f"scp error: {e}", flush=True)
            try:
                child.close(force=True)
            except Exception:
                pass
        time.sleep(3)
    raise SystemExit(f"SCP failed for {label}")


def deploy() -> None:
    for a in range(1, 8):
        print(f"=== SSH deploy attempt {a} ===", flush=True)
        wait_port(5)
        child = pexpect.spawn(
            f"ssh -tt -o PreferredAuthentications=password -o PubkeyAuthentication=no "
            f"-o StrictHostKeyChecking=no -o ConnectTimeout=20 {USER}@{HOST}",
            encoding="utf-8",
            timeout=300,
        )
        try:
            i = child.expect([r"(?i)password:", pexpect.TIMEOUT, pexpect.EOF], timeout=60)
            if i != 0:
                raise RuntimeError(f"no password prompt ({i})")
            child.sendline(PW)
            child.expect([r"\$ ", r"# "], timeout=60)
            child.sendline(
                "ls -lh /tmp/fe_deploy.tgz /tmp/deploy_fe2.sh && bash /tmp/deploy_fe2.sh"
            )
            i = child.expect([r"FE_DEPLOY_OK", pexpect.TIMEOUT, pexpect.EOF], timeout=180)
            print(f"deploy_expect={i}", flush=True)
            print((child.before or "")[-2500:], flush=True)
            if i == 0:
                print("DEPLOY_SUCCESS", flush=True)
                child.sendline("exit")
                return
        except Exception as e:
            print(f"ssh error: {e}", flush=True)
            try:
                child.close(force=True)
            except Exception:
                pass
        time.sleep(4)
    raise SystemExit("deploy failed")


def main() -> None:
    if not PW:
        print("Set AHRI_SSH_PASSWORD", file=sys.stderr)
        sys.exit(2)
    for path in (TGZ, SCRIPT):
        if not os.path.isfile(path):
            raise SystemExit(f"missing {path}")
    scp(SCRIPT, "/tmp/deploy_fe2.sh", "script")
    scp(TGZ, "/tmp/fe_deploy.tgz", "tgz")
    print("ALL_SCP_OK", flush=True)
    deploy()


if __name__ == "__main__":
    main()
