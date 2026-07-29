# MNTD Live Server Persona UAT Report

**Date:** 2026-06-03  
**Environment:** `https://192.168.25.25`  
**Release:** `v2026.06.03.04`  
**Frontend bundle:** `main.013e5942.js`  
**Tester:** Automated API UAT + live server remediation

---

## Executive summary

**Root cause of “Failed to update sample status” / registration blocked:** the
live server was **missing**
`volume/configuration/backend/workflow-registry/ahri-workflows.csv`. Without
this file, the backend workflow registry was empty, so **every non–Global Admin
user received HTTP 403** on notebook write APIs (register, apply, complete). The
UI shows a generic **“Failed to update sample status.”** message for any non-200
response.

**Remediation applied on live server:**

1. Deployed
   [`ahri-workflows.csv`](../volume/configuration/backend/workflow-registry/ahri-workflows.csv)
   to  
   `/opt/OpenELIS-Docker/volume/configuration/backend/workflow-registry/ahri-workflows.csv`
2. Restarted `openelisglobal-webapp` — log confirms: **“Loaded 137 workflow
   stages from ahri-workflows.csv”**
3. Seeded 7 MNTD persona test users via updated
   [`populate-notebook-users.sh`](../scripts/populate-notebook-users.sh)

**After fix:** Sample Collector / Lab Technician / Lab Manager can register and
process samples. Junior Researcher and Biomedical Staff are correctly denied on
intake. **Overall verdict: PASS with one known page-order data issue on notebook
17 (page 10).**

---

## Users created (password: `adminADMIN!`)

| Username          | User ID | Department | SRS persona           |
| ----------------- | ------- | ---------- | --------------------- |
| `mntd_collector`  | 1100    | MNTD (177) | Sample Collector      |
| `mntd_technician` | 1101    | MNTD (177) | Laboratory Technician |
| `mntd_researcher` | 1102    | MNTD (177) | Junior Researcher     |
| `mntd_senior`     | 1113    | MNTD (177) | Senior Researcher     |
| `mntd_manager`    | 1103    | MNTD (177) | Lab Manager           |
| `mntd_biomedical` | 1104    | MNTD (177) | Biomedical Staff      |

Script change: dynamic `test_section` / `system_role` lookup + new `mntd_senior`
user (Senior Researcher was missing from original seed script).

---

## Live discovery IDs

| Item                  | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| MNTD test section     | **177** — Malaria and Neglected Tropical Disease (MNTD) Laboratory |
| Notebook (UI)         | **17** — `/NoteBookInstanceEditForm/17`                            |
| Notebook entry        | **1**                                                              |
| Biorepository section | **182**                                                            |
| Storage rooms         | 66                                                                 |
| Analyzers             | 0 (Pages 7–8 may need manual instrument linkage)                   |

### Notebook 17 page IDs

| Page | Title              | DB page ID | page_order                             |
| ---- | ------------------ | ---------- | -------------------------------------- |
| 1    | Sample Intake      | 175        | 1                                      |
| 2    | Lab Reception      | 176        | 2                                      |
| 3    | Temp Storage       | 177        | 3                                      |
| 4    | Processing Prep    | 178        | 4                                      |
| 5    | Aliquoting         | 179        | 5                                      |
| 6    | Processing QC      | 180        | 6                                      |
| 7    | Test Assignment    | 181        | 7                                      |
| 8    | Test Execution     | 182        | 8                                      |
| 9    | Sample Archiving   | 2056       | 9                                      |
| 10   | Data Analysis      | 183        | **9 (duplicate order — see blockers)** |
| 11   | Reporting & REDCap | 184        | 10                                     |

---

## Critical fix: missing workflow registry

| Check                                         | Before fix  | After fix                         |
| --------------------------------------------- | ----------- | --------------------------------- |
| `ahri-workflows.csv` on server                | **Missing** | **Present** (137 stages loaded)   |
| `mntd_collector` → mark registered (page 175) | **403**     | **200**                           |
| `mntd_technician` → page 175 status           | **403**     | **200**                           |
| `mntd_manager` → page 175 status              | **403**     | **200**                           |
| `mntd_researcher` → page 175 status           | 403         | **403 (correct — denied intake)** |
| `admin` → page 175 status                     | 200         | 200                               |

**Why admin worked but MNTD users did not:** Global Administrator bypasses SRS
persona checks. All department-scoped users depend on the loaded workflow
registry.

---

## E2E sample pipeline (live sample)

**Test sample:** `Ach 21-FY001-006` (notebook page sample id **396519**)  
**Flow:** Pages 1 → 11 with designated persona per plan.

| Page | Title            | Actor             | Action                         | HTTP    | Result                                        |
| ---- | ---------------- | ----------------- | ------------------------------ | ------- | --------------------------------------------- |
| 1    | Sample Intake    | `mntd_collector`  | Mark as registered (COMPLETED) | 200     | **PASS**                                      |
| 2    | Lab Reception    | `mntd_technician` | Apply reception fields         | 200     | **PASS**                                      |
| 3    | Temp Storage     | `mntd_technician` | Apply storage location         | 200     | **PASS**                                      |
| 4    | Processing Prep  | `mntd_researcher` | Bulk apply prep data           | 200     | **PASS**                                      |
| 5    | Aliquoting       | `mntd_researcher` | Bulk apply                     | 200     | **PASS**                                      |
| 6    | Processing QC    | `mntd_technician` | Bulk apply QC                  | 200     | **PASS**                                      |
| 7    | Test Assignment  | `mntd_senior`     | Bulk apply scheduling          | 200     | **PASS**                                      |
| 8    | Test Execution   | `mntd_senior`     | Bulk apply execution           | 200     | **PASS**                                      |
| 9    | Sample Archiving | `mntd_manager`    | Bulk apply archive             | 200     | **PASS**                                      |
| 10   | Data Analysis    | `mntd_senior`     | Bulk apply                     | **403** | **FAIL** (page order mismatch — see blockers) |
| 11   | Reporting        | `mntd_manager`    | Bulk apply                     | 200     | **PASS**                                      |

**Manifest import (new UAT CSV):** **BLOCKED** — `POST .../create-from-manifest`
returns 500 (audit log / transaction rollback in server logs). Existing pending
samples can be used for registration testing.

---

## Page 3 biorepository branch

| Step                                                       | Result  |
| ---------------------------------------------------------- | ------- |
| Register pending sample on Page 1 as collector             | 200     |
| Reception on Page 2 as technician                          | 200     |
| Mark COMPLETED on Page 3 (temp storage exit) as technician | **200** |

Sample leaves Page 3 active queue via COMPLETED status (does not require
advancing to Page 4).

---

## RBAC matrix (API spot-checks after registry fix)

Uses `POST /rest/notebook/bulk/page/{pageId}/samples/apply` with sample id 2 and
test data.  
**403 = correctly denied; 200/400 = allowed (400 only when validation fails
before ACL).**

| Persona               | Allowed pages tested | Denied pages tested | Result                               |
| --------------------- | -------------------- | ------------------- | ------------------------------------ |
| Sample Collector      | 1, 2                 | 3, 4, 9, 10         | **PASS**                             |
| Laboratory Technician | 1, 2, 3, 4           | 9, 10, 11           | **PASS**                             |
| Junior Researcher     | 4, 5                 | 1, 2, 9             | **PASS**                             |
| Senior Researcher     | 4, 7                 | 1, 6, 9             | **PASS** (page 10 fail = data issue) |
| Lab Manager           | 1, 9, 10, 11         | —                   | **PASS**                             |
| Biomedical Staff      | —                    | 1, 4                | **PASS**                             |

**Spot-check score:** 29/30 (single fail: Senior Researcher page 10 — see
below).

---

## Blockers and recommendations

### 1. Missing workflow registry on deploy (FIXED)

Ensure every deployment includes:

```
volume/configuration/backend/workflow-registry/ahri-workflows.csv
```

Mount is already configured in `docker-compose.yml`
(`./volume/configuration:/var/lib/openelis-global/configuration`); the
directory/file was never copied to the server.

### 2. Notebook 17 duplicate page_order (OPEN)

Pages **2056** (Archiving) and **183** (Data Analysis) both have
`page_order = 9`. Backend RBAC resolves stage by order, so page 183 is treated
as **stage 9 (Archiving — Lab Manager only)** instead of **stage 10 (Analysis —
Senior Researcher)**.

**Recommendation:** Fix page_order in DB or re-seed notebook 17 pages from
Liquibase template so orders 1–11 are unique.

### 3. Manifest import 500 (OPEN)

New CSV import fails with server error / audit rollback. Use existing pending
samples for intake testing until fixed.

### 4. User workflow reminders

- Select **Malaria and Neglected Tropical Disease (MNTD) Laboratory** in the
  header after login.
- **Log out and back in** after Admin changes lab-unit roles (session caches
  roles at login).
- Assign **one SRS persona per test user** for RBAC proof; multiple personas on
  one account behave differently.

---

## How to re-run

```bash
# On server (after CSV deployed)
CONTAINER=openelisglobal-database /opt/OpenELIS-Docker/populate-notebook-users.sh --clean-install

# From dev machine
python3 OpenELIS-Global-2/scripts/run-mntd-live-uat.py
```

---

## Summary counts

| Category                      | Pass | Fail | Blocked |
| ----------------------------- | ---- | ---- | ------- |
| Registry / registration fix   | 1    | 0    | 0       |
| E2E pipeline (11 pages)       | 10   | 1    | 0       |
| Biorepo Page 3 branch         | 1    | 0    | 0       |
| RBAC spot-checks              | 29   | 1    | 0       |
| Manifest import (new samples) | 0    | 0    | 1       |

**Overall: PASS** — MNTD persona permissions work after workflow registry
deployment. Remaining issues are notebook page-order data and manifest import,
not RBAC logic.
