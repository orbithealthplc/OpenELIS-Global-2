#!/usr/bin/env python3
"""AHRI LIMS browser UAT: stage order + Restricted access vs ahri-workflows.csv."""
from __future__ import annotations

import csv
import json
import re
import sys
import traceback
from pathlib import Path

import requests
import urllib3
from playwright.sync_api import sync_playwright

urllib3.disable_warnings()

BASE = "https://lims.ahri.gov.et"
APIS = [
    f"{BASE}/OpenELIS-Global",
    f"{BASE}/api/OpenELIS-Global",
]
ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "volume/configuration/backend/workflow-registry/ahri-workflows.csv"
ART = ROOT / "output/playwright/ahri-uat"
OUT_DIR = Path(__file__).resolve().parent
UAT_DATE = "2026-07-23"
FINISHED_DEPTS = (
    "Bacteriology",
    "Pathology",
    "MNTD",
    "Immunology",
    "Biorepository",
    "Bioanalytical",
    "Bioequivalence",
)


def log(*args):
    print(*args, flush=True)


def load_registry():
    registry = {}
    with CSV_PATH.open() as f:
        for row in csv.DictReader(f):
            wt = row["workflowType"].strip().lower().replace(" ", "_")
            registry.setdefault(wt, []).append(
                {
                    "order": int(row["stageOrder"]),
                    "title": row["stageTitle"].strip(),
                    "personas": [
                        p.strip()
                        for p in row["allowedPersonas"].split("|")
                        if p.strip()
                    ],
                }
            )
    return registry


def api_login(user: str, pwd: str, lab: str, attempts: int = 5):
    """Login with retries — prod lims.ahri.gov.et has intermittent connect timeouts."""
    import time

    last = None
    for attempt in range(1, attempts + 1):
        for api in APIS:
            s = requests.Session()
            s.verify = False
            try:
                r = s.post(
                    f"{api}/ValidateLogin?apiCall=true",
                    data={"loginName": user, "password": pwd},
                    timeout=60,
                )
                j = r.json()
                if not j.get("success"):
                    last = j
                    continue
                r2 = s.post(f"{api}/rest/setUserLoginLabUnit/{lab}", timeout=60)
                j2 = r2.json()
                if j2.get("success"):
                    return s, api
                last = j2
            except Exception as e:
                last = str(e)
        if attempt < attempts:
            wait = min(8 * attempt, 30)
            log(f"  login retry {attempt}/{attempts} for {user} after {wait}s ({last})")
            time.sleep(wait)
    raise RuntimeError(f"login failed for {user}: {last}")


def cookie_list(sess: requests.Session):
    """Playwright cookies: duplicate JSESSIONID at path=/ so the React SPA auth works.

    Java login sets Path=/OpenELIS-Global (or /api/...), which browsers will not send
    on /NoteBookInstanceEditForm/... — replicate to path=/ for UI UAT.
    """
    cookies = []
    for c in sess.cookies:
        domain = (c.domain or "lims.ahri.gov.et").lstrip(".")
        # SPA routes (path=/)
        cookies.append(
            {
                "name": c.name,
                "value": c.value,
                "domain": domain,
                "path": "/",
            }
        )
        # API routes (original path)
        if c.path and c.path not in ("/", ""):
            cookies.append(
                {
                    "name": c.name,
                    "value": c.value,
                    "domain": domain,
                    "path": c.path,
                }
            )
    return cookies


def scrape(page):
    return page.evaluate(
        """() => {
      const body = document.body ? document.body.innerText : '';
      const root = document.querySelector('.page-navigation');
      const text = root ? root.innerText : '';
      let titles = [];
      if (root) {
        const btns = [...root.querySelectorAll('button, .page-navigation-item, [role="button"]')];
        titles = btns
          .map(b => (b.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean)[0])
          .filter(Boolean);
      }
      if (titles.length < 3 && text) {
        titles = text.split('\\n').map(s => s.trim()).filter(s =>
          s && !/^(Restricted|Complete|Pending|In Progress|\\d+%?)$/i.test(s)
        );
      }
      return {
        url: location.href,
        hasNav: !!root,
        navText: (text || '').slice(0, 2500),
        bodyHead: body.slice(0, 900),
        titles,
        restrictedCount: ((text || '').match(/Restricted/gi) || []).length,
      };
    }"""
    )


def open_workflow_tab(page):
    """URL tab=workflow is not always honored — click the Workflow tab explicitly."""
    try:
        loc = page.get_by_role("tab", name=re.compile("Workflow", re.I))
        if loc.count() > 0:
            loc.first.click(timeout=5000)
            page.wait_for_timeout(1500)
            return True
    except Exception:
        pass
    try:
        page.locator(".cds--tabs__nav-link, [role='tab']").filter(
            has_text=re.compile("Workflow", re.I)
        ).first.click(timeout=5000)
        page.wait_for_timeout(1500)
        return True
    except Exception:
        return False


def expected_restricted(registry, workflow, persona, visible_titles=None):
    stages = registry.get(workflow) or []
    if workflow == "pathology" and not stages:
        for k in ("pathology", "fnac", "histopathology_biopsy_tissue"):
            if k in registry:
                stages = registry[k]
                break
    if workflow == "gbd" and not stages:
        stages = registry.get("genomics") or []
    # FNAC notebooks hide histo-only orders (3–6); match against visible titles when provided
    if workflow == "pathology" and visible_titles:
        vis = {re.sub(r"^\d+[\.\):\-\s]*", "", t).strip().lower() for t in visible_titles}
        stages = [
            st
            for st in stages
            if any(
                st["title"].lower() in v or v in st["title"].lower()
                for v in vis
            )
        ]
    out = []
    for st in stages:
        # Match CSV allowedPersonas only (Lab Manager supervisor override).
        # Pathologist / Cytopathologist are specialty personas — not full-access.
        ok = persona in st["personas"] or persona == "Lab Manager"
        if not ok:
            out.append(st["title"])
    return out, stages


def ui_login(page, user, pwd, lab_hint):
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60000)
    page.fill("#loginName", user)
    page.fill("#password", pwd)
    page.locator("[data-cy='loginButton']").click()
    page.wait_for_timeout(2500)
    # optional lab unit select
    if page.locator("select").count() > 0:
        try:
            page.locator("select").first.select_option(
                label=re.compile(re.escape(lab_hint[:12]), re.I)
            )
        except Exception:
            opts = page.locator("select").first.locator("option")
            for i in range(opts.count()):
                t = opts.nth(i).inner_text()
                if lab_hint.split()[0].lower() in t.lower():
                    page.locator("select").first.select_option(index=i)
                    break
        try:
            page.locator(
                "button[type='submit'], button:has-text('Submit'), button:has-text('Continue')"
            ).first.click(timeout=4000)
        except Exception:
            pass
        page.wait_for_timeout(1500)


CASES = [
    # Bacteriology full
    *(
        (
            "Bacteriology",
            "bacteriology",
            "168",
            "Bacteriology",
            "BacTest!2026",
            225,
            100,
            u,
            p,
        )
        for u, p in [
            ("bac_collector", "Sample Collector"),
            ("bac_tech", "Laboratory Technician"),
            ("bac_manager", "Lab Manager"),
            ("bac_jr_researcher", "Junior Researcher"),
            ("bac_sr_researcher", "Senior Researcher"),
            ("bac_biomedical", "Biomedical Staff"),
        ]
    ),
    # Pathology
    *(
        (
            "Pathology",
            "pathology",
            "176",
            "Pathology",
            "PathTest!2026",
            220,
            96,
            u,
            p,
        )
        for u, p in [
            ("path_collector", "Sample Collector"),
            ("path_tech", "Laboratory Technician"),
            ("path_manager", "Lab Manager"),
            ("path_pathologist", "Pathologist"),
            ("path_cyto", "Cytopathologist"),
            ("path_jr_researcher", "Junior Researcher"),
            ("path_sr_researcher", "Senior Researcher"),
        ]
    ),
    # MNTD
    *(
        (
            "MNTD",
            "mntd",
            "177",
            "Malaria",
            "adminADMIN!",
            228,
            103,
            u,
            p,
        )
        for u, p in [
            ("mntd_collector", "Sample Collector"),
            ("mntd_technician", "Laboratory Technician"),
            ("mntd_manager", "Lab Manager"),
            ("mntd_researcher", "Junior Researcher"),
            ("mntd_senior", "Senior Researcher"),
            ("mntd_biomedical", "Biomedical Staff"),
        ]
    ),
    # Remaining departments — every persona
    *(
        (
            "Immunology",
            "immunology",
            "59",
            "Immunology",
            "ImmTest!2026",
            233,
            108,
            u,
            p,
        )
        for u, p in [
            ("imm_collector", "Sample Collector"),
            ("imm_tech", "Laboratory Technician"),
            ("imm_manager", "Lab Manager"),
            ("imm_jr_researcher", "Junior Researcher"),
            ("imm_sr_researcher", "Senior Researcher"),
            ("imm_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Biorepository",
            "biorepository",
            "182",
            "Biorepository",
            "BioTest!2026",
            232,
            107,
            u,
            p,
        )
        for u, p in [
            ("bio_collector", "Sample Collector"),
            ("bio_tech", "Laboratory Technician"),
            ("bio_manager", "Lab Manager"),
            ("bio_jr_researcher", "Junior Researcher"),
            ("bio_sr_researcher", "Senior Researcher"),
            ("bio_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "TB",
            "tuberculosis",
            "180",
            "Tuberculosis",
            "TbTest!2026",
            235,
            119,
            u,
            p,
        )
        for u, p in [
            ("tb_collector", "Sample Collector"),
            ("tb_tech", "Laboratory Technician"),
            ("tb_manager", "Lab Manager"),
            ("tb_jr_researcher", "Junior Researcher"),
            ("tb_sr_researcher", "Senior Researcher"),
            ("tb_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Pharma",
            "pharmaceutical",
            "178",
            "Pharmaceutical",
            "PharmTest!2026",
            236,
            120,
            u,
            p,
        )
        for u, p in [
            ("pharm_collector", "Sample Collector"),
            ("pharm_tech", "Laboratory Technician"),
            ("pharm_manager", "Lab Manager"),
            ("pharm_jr_researcher", "Junior Researcher"),
            ("pharm_sr_researcher", "Senior Researcher"),
            ("pharm_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Traditional",
            "traditional_medicine",
            "173",
            "Traditional",
            "TradTest!2026",
            237,
            121,
            u,
            p,
        )
        for u, p in [
            ("trad_collector", "Sample Collector"),
            ("trad_tech", "Laboratory Technician"),
            ("trad_manager", "Lab Manager"),
            ("trad_jr_researcher", "Junior Researcher"),
            ("trad_sr_researcher", "Senior Researcher"),
            ("trad_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Bioanalytical",
            "bioanalytical",
            "174",
            "Bioanalytical",
            "BanalTest!2026",
            238,
            122,
            u,
            p,
        )
        for u, p in [
            ("banal_collector", "Sample Collector"),
            ("banal_tech", "Laboratory Technician"),
            ("banal_manager", "Lab Manager"),
            ("banal_jr_researcher", "Junior Researcher"),
            ("banal_sr_researcher", "Senior Researcher"),
            ("banal_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Bioequivalence",
            "bioequivalence",
            "175",
            "Bioequivalence",
            "BeqTest!2026",
            239,
            123,
            u,
            p,
        )
        for u, p in [
            ("beq_collector", "Sample Collector"),
            ("beq_tech", "Laboratory Technician"),
            ("beq_manager", "Lab Manager"),
            ("beq_jr_researcher", "Junior Researcher"),
            ("beq_sr_researcher", "Senior Researcher"),
            ("beq_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Medlab/CTD",
            "medlab",
            "303",
            "Medical",
            "MedlabTest!2026",
            234,
            118,
            u,
            p,
        )
        for u, p in [
            ("medlab_collector", "Sample Collector"),
            ("medlab_tech", "Laboratory Technician"),
            ("medlab_manager", "Lab Manager"),
            ("medlab_jr_researcher", "Junior Researcher"),
            ("medlab_sr_researcher", "Senior Researcher"),
            ("medlab_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Genomics",
            "gbd",
            "172",
            "Genomics",
            "GenTest!2026",
            231,
            106,
            u,
            p,
        )
        for u, p in [
            ("gen_collector", "Sample Collector"),
            ("gen_tech", "Laboratory Technician"),
            ("gen_manager", "Lab Manager"),
            ("gen_jr_researcher", "Junior Researcher"),
            ("gen_sr_researcher", "Senior Researcher"),
            ("gen_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Virology",
            "virology",
            "203",
            "Virology",
            "VirTest!2026",
            240,
            124,
            u,
            p,
        )
        for u, p in [
            ("vir_collector", "Sample Collector"),
            ("vir_tech", "Laboratory Technician"),
            ("vir_manager", "Lab Manager"),
            ("vir_jr_researcher", "Junior Researcher"),
            ("vir_sr_researcher", "Senior Researcher"),
            ("vir_biomedical", "Biomedical Staff"),
        ]
    ),
    *(
        (
            "Viral Vaccine",
            "viral_vaccine",
            "179",
            "Viral Vaccine",
            "VvTest!2026",
            241,
            125,
            u,
            p,
        )
        for u, p in [
            ("vv_collector", "Sample Collector"),
            ("vv_tech", "Laboratory Technician"),
            ("vv_manager", "Lab Manager"),
            ("vv_jr_researcher", "Junior Researcher"),
            ("vv_sr_researcher", "Senior Researcher"),
            ("vv_biomedical", "Biomedical Staff"),
        ]
    ),
]

def run(only_dept: str | None = None):
    ART.mkdir(parents=True, exist_ok=True)
    registry = load_registry()
    results = []
    finished_only = only_dept and only_dept.lower() in ("finished", "done", "pass")
    cases = []
    for c in CASES:
        if finished_only:
            if c[0] in FINISHED_DEPTS:
                cases.append(c)
        elif only_dept is None or c[0].lower().startswith(only_dept.lower()):
            cases.append(c)
    log(f"cases={len(cases)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, args=["--disable-dev-shm-usage", "--no-sandbox"]
        )
        log("browser launched")
        for dept, workflow, lab, lab_hint, pwd, nb, entry, user, persona in cases:
            log(f"== {dept} / {user} ==")
            row = {
                "dept": dept,
                "workflow": workflow,
                "user": user,
                "persona": persona,
                "notebookId": nb,
                "entryId": entry,
            }
            try:
                sess, _api = api_login(user, pwd, lab)
                ctx = browser.new_context(
                    ignore_https_errors=True, viewport={"width": 1400, "height": 900}
                )
                ctx.add_cookies(cookie_list(sess))
                page = ctx.new_page()
                url = f"{BASE}/NoteBookInstanceEditForm/{nb}?mode=edit&tab=workflow&entryId={entry}"

                def goto_workflow():
                    last_err = None
                    for attempt in range(1, 4):
                        try:
                            page.goto(url, wait_until="commit", timeout=120000)
                            return
                        except Exception as e:
                            last_err = e
                            log(f"  goto retry {attempt}/3: {e}")
                            page.wait_for_timeout(min(5000 * attempt, 15000))
                    raise last_err

                goto_workflow()
                page.wait_for_timeout(4000)
                try:
                    page.wait_for_selector("text=Workflow", timeout=25000)
                except Exception:
                    pass
                open_workflow_tab(page)
                try:
                    page.wait_for_selector(".page-navigation", timeout=60000)
                except Exception:
                    # Accordion-only template UI = wrong tab component / missing workflowType
                    page.wait_for_timeout(3000)
                    if page.locator(".page-navigation").count() == 0:
                        log("  no .page-navigation — hard reload + Workflow tab")
                        goto_workflow()
                        page.wait_for_timeout(5000)
                        open_workflow_tab(page)
                        try:
                            page.wait_for_selector(".page-navigation", timeout=45000)
                        except Exception:
                            page.wait_for_timeout(3000)
                data = scrape(page)
                if "login" in data["url"].lower() or (
                    not data["hasNav"]
                    and ("Login" in (data.get("bodyHead") or "") or "loginName" in (data.get("bodyHead") or ""))
                ):
                    log("  cookie weak → UI login")
                    ui_login(page, user, pwd, lab_hint)
                    sess2, _ = api_login(user, pwd, lab)
                    ctx.clear_cookies()
                    ctx.add_cookies(cookie_list(sess2))
                    page.goto(url, wait_until="commit", timeout=120000)
                    page.wait_for_timeout(5000)
                    open_workflow_tab(page)
                    try:
                        page.wait_for_selector(".page-navigation", timeout=45000)
                    except Exception:
                        page.wait_for_timeout(3000)
                    data = scrape(page)
                elif not data["hasNav"]:
                    log("  no nav yet → retry Workflow tab")
                    open_workflow_tab(page)
                    try:
                        page.wait_for_selector(".page-navigation", timeout=30000)
                    except Exception:
                        page.wait_for_timeout(3000)
                    data = scrape(page)

                shot = ART / f"{dept.replace('/', '-')}_{user}.png"
                try:
                    page.screenshot(path=str(shot), timeout=15000)
                except Exception:
                    pass

                titles = data.get("titles") or []
                exp_restr, stages = expected_restricted(
                    registry,
                    workflow,
                    persona,
                    visible_titles=titles if workflow == "pathology" else None,
                )
                # bac order
                order_ok = None
                if workflow == "bacteriology":
                    isolate_i = next(
                        (i for i, t in enumerate(titles) if "isolate" in t.lower()), -1
                    )
                    storage_i = next(
                        (
                            i
                            for i, t in enumerate(titles)
                            if "temporary storage" in t.lower()
                            or (
                                "storage assignment" in t.lower()
                                and "post" not in t.lower()
                            )
                        ),
                        -1,
                    )
                    order_ok = isolate_i >= 0 and storage_i >= 0 and isolate_i < storage_i
                    if order_ok and isolate_i != 2:
                        # still ok if order is SRS-relative
                        order_ok = isolate_i < storage_i

                restr_count = data.get("restrictedCount") or 0
                if persona == "Lab Manager":
                    access_ok = data["hasNav"] and restr_count == 0
                elif not data["hasNav"]:
                    access_ok = False
                elif len(exp_restr) == 0:
                    access_ok = restr_count == 0
                else:
                    # Biomedical Staff: not on any CSV stage → all Restricted
                    access_ok = restr_count > 0 and abs(
                        restr_count - len(exp_restr)
                    ) <= 1

                ok = bool(data["hasNav"] and access_ok and (order_ok is not False))
                row.update(
                    {
                        "result": "PASS" if ok else "FAIL",
                        "hasNav": data["hasNav"],
                        "order_ok": order_ok,
                        "access_ok": access_ok,
                        "titles": titles[:16],
                        "restrictedCount": restr_count,
                        "expectedRestrictedCount": len(exp_restr),
                        "expectedRestricted": exp_restr,
                        "stageCount": len(stages),
                        "url": data["url"],
                        "screenshot": str(shot),
                        "navText": (data.get("navText") or "")[:600],
                    }
                )
                log(
                    f"  {row['result']} nav={data['hasNav']} order={order_ok} "
                    f"restr={restr_count}/{len(exp_restr)} titles={len(titles)}"
                )
                ctx.close()
            except Exception as e:
                log(f"  ERROR {e}")
                traceback.print_exc()
                row.update({"result": "FAIL", "error": str(e)[:400]})
            results.append(row)
            # incremental save (per-dept file when filtered)
            tag = "finished" if finished_only else (
                only_dept.replace("/", "-").lower() if only_dept else "matrix"
            )
            out_name = f"uat-browser-{tag}-{UAT_DATE}.json"
            (OUT_DIR / out_name).write_text(json.dumps(results, indent=2))
        browser.close()

    passes = sum(1 for r in results if r.get("result") == "PASS")
    log(f"DONE {passes}/{len(results)} PASS")
    tag = "finished" if finished_only else (
        only_dept.replace("/", "-").lower() if only_dept else "matrix"
    )
    out_name = f"uat-browser-{tag}-{UAT_DATE}.json"
    (OUT_DIR / out_name).write_text(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    run(only)
