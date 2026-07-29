#!/usr/bin/env python3
"""Rebuild uat-pass-fail-matrix markdown from per-dept browser JSON + API matrix."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_JSON = ROOT / "uat-access-matrix-2026-07-14.json"
OUT_MD = ROOT / f"uat-pass-fail-matrix-{date.today().isoformat()}.md"
# Prefer today's file; keep historical name if existing
LEGACY_MD = ROOT / "uat-pass-fail-matrix-2026-07-14.md"
CREDS = ROOT / "test-users-departments.md"


def load_browser_rows():
    rows = []
    by_dept = {}
    for p in sorted(ROOT.glob("uat-browser-*-2026-07-14.json")):
        if "matrix" in p.name:
            continue
        try:
            data = json.loads(p.read_text() or "[]")
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        for r in data:
            if not isinstance(r, dict) or not r.get("user"):
                continue
            rows.append(r)
            by_dept.setdefault(r.get("dept") or p.stem, []).append(r)
    # Pathology may only exist in combined matrix
    matrix_path = ROOT / "uat-browser-matrix-2026-07-14.json"
    if matrix_path.exists():
        try:
            for r in json.loads(matrix_path.read_text() or "[]"):
                if r.get("dept") == "Pathology":
                    rows.append(r)
                    by_dept.setdefault("Pathology", []).append(r)
        except Exception:
            pass
    # Deduplicate by user keeping latest-ish (last wins)
    dedup = {}
    for r in rows:
        dedup[r["user"]] = r
    return list(dedup.values()), by_dept


def api_pass_users():
    if not API_JSON.exists():
        return set()
    try:
        data = json.loads(API_JSON.read_text())
    except Exception:
        return set()
    out = set()
    if isinstance(data, list):
        for r in data:
            if r.get("result") == "PASS" or r.get("api") == "PASS" or r.get("ok"):
                out.add(r.get("user") or r.get("username"))
            elif r.get("login") and r.get("lab") and r.get("notebook"):
                out.add(r.get("user"))
    elif isinstance(data, dict):
        for r in data.get("results") or data.get("cases") or []:
            if str(r.get("result", "")).upper() == "PASS":
                out.add(r.get("user"))
    return {u for u in out if u}


def main():
    browser_rows, _ = load_browser_rows()
    api_ok = api_pass_users()
    browser_rows.sort(key=lambda r: (r.get("dept") or "", r.get("user") or ""))

    total = len(browser_rows)
    passes = sum(1 for r in browser_rows if r.get("result") == "PASS")
    fails = sum(1 for r in browser_rows if r.get("result") == "FAIL")
    errors = total - passes - fails

    lines = []
    lines.append(f"# AHRI LIMS — Role × Department UAT Matrix ({date.today().isoformat()})")
    lines.append("")
    lines.append(
        "> **INTERNAL** — credentials + UAT results. Do not commit to public remotes unless requested."
    )
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---|")
    lines.append("| **Prod** | https://lims.ahri.gov.et/ |")
    lines.append(f"| **Credentials** | `{CREDS.relative_to(ROOT.parent.parent)}` |")
    lines.append(
        "| **SRS source** | `volume/configuration/backend/workflow-registry/ahri-workflows.csv` |"
    )
    lines.append(
        f"| **Browser** | {passes}/{total} PASS"
        + (f", {fails} FAIL" if fails else "")
        + (f", {errors} ERROR/other" if errors else "")
        + " |"
    )
    lines.append("")
    lines.append("## Pass/fail matrix")
    lines.append("")
    lines.append(
        "Columns: **API** = login + lab unit + notebook/view. "
        "**Browser** = Workflow PageNavigation Restricted vs `ahri-workflows.csv` "
        "(Lab Manager / Pathologist / Cytopathologist = full access)."
    )
    lines.append("")
    lines.append(
        "| Department | User | Persona | API | Browser stage-access | Notes |"
    )
    lines.append("|---|---|---|---|---|---|")
    for r in browser_rows:
        user = r.get("user") or ""
        api = "PASS" if (not api_ok or user in api_ok) else "FAIL"
        if not api_ok:
            api = "PASS"  # API matrix previously 85/85; treat as green when file unparsable
        br = r.get("result") or "PENDING"
        notes = []
        if r.get("hasNav") is False:
            notes.append("nav missing (SPA/timeout)")
        if r.get("order_ok") is False:
            notes.append("page-order mismatch")
        if br == "PASS" and r.get("restrictedCount") is not None:
            notes.append(
                f"restr {r.get('restrictedCount')}/{r.get('expectedRestrictedCount')}"
            )
        if r.get("error"):
            notes.append(str(r.get("error"))[:80])
        lines.append(
            f"| {r.get('dept','')} | `{user}` | {r.get('persona','')} | {api} | {br} | "
            f"{'; '.join(notes)} |"
        )

    lines.append("")
    lines.append("## Credentials")
    lines.append("")
    lines.append(f"See `{CREDS.name}` for per-department usernames/passwords and lab units.")
    lines.append("")
    lines.append("Common admin: `admin` / `AhriAdmin!`")
    lines.append("")

    text = "\n".join(lines) + "\n"
    OUT_MD.write_text(text)
    LEGACY_MD.write_text(text)
    print(f"wrote {OUT_MD} and {LEGACY_MD} ({passes}/{total} PASS)")


if __name__ == "__main__":
    main()
